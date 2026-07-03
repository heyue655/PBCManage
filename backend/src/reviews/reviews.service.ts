import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveDto, RejectDto, SupervisorEvaluateDto } from './dto';
import { DingtalkService } from '../dingtalk/dingtalk.service';
import { SystemConfigService } from '../system-config/system-config.service';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private dingtalkService: DingtalkService,
    private systemConfigService: SystemConfigService,
  ) {}

  private async getSupervisorType(reviewerId: number, targetUserId: number): Promise<'functional' | 'business' | null> {
    const targetUser = await this.prisma.user.findUnique({
      where: { user_id: targetUserId },
    });
    if (!targetUser) return null;
    if (targetUser.functional_supervisor_id === reviewerId) return 'functional';
    if (targetUser.business_supervisor_id === reviewerId) return 'business';
    return null;
  }

  private async hasDualSupervisor(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) return false;
    return !!user.functional_supervisor_id && !!user.business_supervisor_id
      && user.functional_supervisor_id !== user.business_supervisor_id;
  }

  async getPendingReviews(supervisorId: number) {
    const subordinates = await this.prisma.user.findMany({
      where: {
        OR: [
          { functional_supervisor_id: supervisorId },
          { business_supervisor_id: supervisorId },
        ],
      },
    });

    if (subordinates.length === 0) return [];

    const subordinateIds = subordinates.map(s => s.user_id);

    const goals = await this.prisma.pbcGoal.findMany({
      where: {
        user_id: { in: subordinateIds },
        status: 'submitted',
        parent_goal_id: null,
      },
      include: {
        user: {
          include: {
            functionalSupervisor: { select: { user_id: true, real_name: true } },
            businessSupervisor: { select: { user_id: true, real_name: true } },
          },
        },
        period: true,
        subGoals: true,
      },
    });

    const filteredGoals = [];
    for (const goal of goals) {
      const existingApproval = await this.prisma.pbcApproval.findFirst({
        where: {
          goal_id: goal.goal_id,
          reviewer_id: supervisorId,
          action: 'approve',
        },
      });
      if (!existingApproval) {
        filteredGoals.push(goal);
      }
    }

    return filteredGoals;
  }

  async approve(goalId: number, reviewerId: number, approveDto: ApproveDto) {
    const sampleGoal = await this.prisma.pbcGoal.findUnique({
      where: { goal_id: goalId },
      include: {
        user: {
          include: {
            functionalSupervisor: { select: { user_id: true, real_name: true, dingtalk_userid: true, organization: true } },
            businessSupervisor: { select: { user_id: true, real_name: true, dingtalk_userid: true, organization: true } },
          },
        },
        period: true,
      },
    });

    if (!sampleGoal) throw new NotFoundException('目标不存在');

    const supervisorType = await this.getSupervisorType(reviewerId, sampleGoal.user_id);
    if (!supervisorType) await this.validateReviewPermission(reviewerId, sampleGoal.user_id);
    if (sampleGoal.status !== 'submitted') throw new BadRequestException('当前状态不允许审核');

    const allGoals = await this.prisma.pbcGoal.findMany({
      where: {
        user_id: sampleGoal.user_id,
        period_id: sampleGoal.period_id,
        status: 'submitted',
        parent_goal_id: null,
      },
      include: { subGoals: true },
    });

    if (allGoals.length === 0) throw new BadRequestException('没有待审核的目标');

    const goalIds = allGoals.map(g => g.goal_id);
    const hasDual = await this.hasDualSupervisor(sampleGoal.user_id);

    if (hasDual) {
      const existingApprovals = await this.prisma.pbcApproval.findMany({
        where: { goal_id: { in: goalIds }, action: 'approve' },
      });

      const functionalApproved = existingApprovals.some(a => a.supervisor_type === 'functional');
      const businessApproved = existingApprovals.some(a => a.supervisor_type === 'business');

      if ((supervisorType === 'functional' && functionalApproved) ||
          (supervisorType === 'business' && businessApproved)) {
        throw new BadRequestException('您已经审核过了');
      }

      for (const goal of allGoals) {
        await this.prisma.pbcApproval.create({
          data: {
            goal_id: goal.goal_id,
            reviewer_id: reviewerId,
            action: 'approve',
            comments: approveDto.comments,
            supervisor_type: supervisorType,
          },
        });
      }

      const otherTypeApproved = supervisorType === 'functional' ? businessApproved : functionalApproved;
      if (otherTypeApproved) {
        await this.prisma.pbcGoal.updateMany({ where: { goal_id: { in: goalIds } }, data: { status: 'approved' } });
        const allSubGoalIds = allGoals.flatMap(g => g.subGoals?.map(sg => sg.goal_id) || []);
        if (allSubGoalIds.length > 0) {
          await this.prisma.pbcGoal.updateMany({ where: { goal_id: { in: allSubGoalIds } }, data: { status: 'approved' } });
        }
      }
    } else {
      await this.prisma.pbcGoal.updateMany({ where: { goal_id: { in: goalIds } }, data: { status: 'approved' } });
      const allSubGoalIds = allGoals.flatMap(g => g.subGoals?.map(sg => sg.goal_id) || []);
      if (allSubGoalIds.length > 0) {
        await this.prisma.pbcGoal.updateMany({ where: { goal_id: { in: allSubGoalIds } }, data: { status: 'approved' } });
      }
      for (const goal of allGoals) {
        await this.prisma.pbcApproval.create({
          data: {
            goal_id: goal.goal_id,
            reviewer_id: reviewerId,
            action: 'approve',
            comments: approveDto.comments,
            supervisor_type: supervisorType || 'functional',
          },
        });
      }
    }

    try {
      if (sampleGoal.user.dingtalk_userid) {
        const periodName = sampleGoal.period ? `${sampleGoal.period.year}年第${sampleGoal.period.quarter}季度` : '当前周期';
        const reviewer = await this.prisma.user.findUnique({ where: { user_id: reviewerId } });
        await this.dingtalkService.sendApproveNotification(
          sampleGoal.user.organization || '安恒',
          sampleGoal.user.dingtalk_userid,
          periodName,
          allGoals.length,
          reviewer?.real_name,
        );
      }
    } catch (error) {
      console.error('发送钉钉通知失败:', error);
    }

    return {
      message: `成功通过 ${allGoals.length} 个目标`,
      count: allGoals.length,
      goals: allGoals.map(g => ({ goal_id: g.goal_id, goal_name: g.goal_name })),
    };
  }

  async reject(goalId: number, reviewerId: number, rejectDto: RejectDto) {
    const sampleGoal = await this.prisma.pbcGoal.findUnique({
      where: { goal_id: goalId },
      include: {
        user: {
          include: {
            functionalSupervisor: { select: { user_id: true, real_name: true, dingtalk_userid: true, organization: true } },
            businessSupervisor: { select: { user_id: true, real_name: true, dingtalk_userid: true, organization: true } },
          },
        },
        period: true,
      },
    });

    if (!sampleGoal) throw new NotFoundException('目标不存在');

    const supervisorType = await this.getSupervisorType(reviewerId, sampleGoal.user_id);
    if (!supervisorType) await this.validateReviewPermission(reviewerId, sampleGoal.user_id);
    if (sampleGoal.status !== 'submitted') throw new BadRequestException('当前状态不允许审核');

    const allGoals = await this.prisma.pbcGoal.findMany({
      where: {
        user_id: sampleGoal.user_id,
        period_id: sampleGoal.period_id,
        status: 'submitted',
        parent_goal_id: null,
      },
      include: { subGoals: true },
    });

    if (allGoals.length === 0) throw new BadRequestException('没有待审核的目标');

    const goalIds = allGoals.map(g => g.goal_id);

    await this.prisma.pbcApproval.deleteMany({
      where: { goal_id: { in: goalIds }, action: 'approve' },
    });

    await this.prisma.pbcGoal.updateMany({ where: { goal_id: { in: goalIds } }, data: { status: 'rejected' } });
    const allSubGoalIds = allGoals.flatMap(g => g.subGoals?.map(sg => sg.goal_id) || []);
    if (allSubGoalIds.length > 0) {
      await this.prisma.pbcGoal.updateMany({ where: { goal_id: { in: allSubGoalIds } }, data: { status: 'rejected' } });
    }

    for (const goal of allGoals) {
      await this.prisma.pbcApproval.create({
        data: {
          goal_id: goal.goal_id,
          reviewer_id: reviewerId,
          action: 'reject',
          comments: rejectDto.reason,
          supervisor_type: supervisorType || 'functional',
        },
      });
    }

    try {
      if (sampleGoal.user.dingtalk_userid) {
        const periodName = sampleGoal.period ? `${sampleGoal.period.year}年第${sampleGoal.period.quarter}季度` : '当前周期';
        const reviewer = await this.prisma.user.findUnique({ where: { user_id: reviewerId } });
        await this.dingtalkService.sendRejectNotification(
          sampleGoal.user.organization || '安恒',
          sampleGoal.user.dingtalk_userid,
          periodName,
          allGoals.length,
          rejectDto.reason,
          reviewer?.real_name,
        );
      }
    } catch (error) {
      console.error('发送钉钉通知失败:', error);
    }

    return {
      message: `已驳回 ${allGoals.length} 个目标`,
      count: allGoals.length,
      reason: rejectDto.reason,
      goals: allGoals.map(g => ({ goal_id: g.goal_id, goal_name: g.goal_name })),
    };
  }

  async archive(goalId: number, reviewerId: number) {
    const goal = await this.prisma.pbcGoal.findUnique({
      where: { goal_id: goalId },
      include: { user: true, subGoals: true },
    });

    if (!goal) throw new NotFoundException('目标不存在');
    await this.validateReviewPermission(reviewerId, goal.user_id);
    if (goal.status !== 'approved') throw new BadRequestException('只能归档已通过的目标');

    const updatedGoal = await this.prisma.pbcGoal.update({
      where: { goal_id: goalId },
      data: { status: 'archived' },
    });

    if (goal.subGoals && goal.subGoals.length > 0) {
      await this.prisma.pbcGoal.updateMany({ where: { parent_goal_id: goalId }, data: { status: 'archived' } });
    }

    return { message: '已归档', goal: updatedGoal };
  }

  async supervisorEvaluate(goalId: number, reviewerId: number, evaluateDto: SupervisorEvaluateDto) {
    const goal = await this.prisma.pbcGoal.findUnique({
      where: { goal_id: goalId },
      include: { user: true },
    });

    if (!goal) throw new NotFoundException('目标不存在');

    const supervisorType = await this.getSupervisorType(reviewerId, goal.user_id);
    if (!supervisorType) await this.validateReviewPermission(reviewerId, goal.user_id);
    if (goal.status !== 'archived') throw new BadRequestException('只能对已归档的目标进行评估');

    const updateData: any = {};
    if (supervisorType === 'business') {
      updateData.business_supervisor_score = evaluateDto.score;
      updateData.business_supervisor_comment = evaluateDto.comment || '';
    } else {
      updateData.functional_supervisor_score = evaluateDto.score;
      updateData.functional_supervisor_comment = evaluateDto.comment || '';
    }

    return this.prisma.pbcGoal.update({ where: { goal_id: goalId }, data: updateData });
  }

  async getApprovalHistory(goalId: number) {
    return this.prisma.pbcApproval.findMany({
      where: { goal_id: goalId },
      include: { reviewer: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async getSubordinatesHistory(supervisorId: number, query: { year?: number; quarter?: number }) {
    const allSubordinateIds = await this.getAllSubordinateIds(supervisorId);
    if (allSubordinateIds.length === 0) return [];

    const where: any = { user_id: { in: allSubordinateIds }, parent_goal_id: null };
    if (query.year || query.quarter) {
      where.period = {};
      if (query.year) where.period.year = query.year;
      if (query.quarter) where.period.quarter = query.quarter;
    }

    return this.prisma.pbcGoal.findMany({ where, include: { user: true, period: true } });
  }

  async getPendingEvaluations(supervisorId: number) {
    const directSubordinates = await this.prisma.user.findMany({
      where: {
        OR: [
          { functional_supervisor_id: supervisorId },
          { business_supervisor_id: supervisorId },
        ],
      },
    });
    const allSubordinateIds = directSubordinates.map(s => s.user_id);
    if (allSubordinateIds.length === 0) return [];

    const evaluations = await this.prisma.pbcEvaluation.findMany({
      where: {
        user_id: { in: allSubordinateIds },
        self_submitted_at: { not: null },
        OR: [
          { functional_submitted_at: null },
          { business_submitted_at: null },
        ],
      },
      include: {
        user: {
          select: {
            user_id: true, real_name: true,
            department: { select: { department_name: true } },
            functional_supervisor_id: true,
            business_supervisor_id: true,
          },
        },
        period: true,
      },
    });

    const result = [];
    for (const ev of evaluations) {
      const isFunctional = ev.user.functional_supervisor_id === supervisorId;
      const isBusiness = ev.user.business_supervisor_id === supervisorId;

      if (isFunctional && ev.functional_submitted_at) continue;
      if (isBusiness && ev.business_submitted_at) continue;

      const goals = await this.prisma.pbcGoal.findMany({
        where: { user_id: ev.user_id, period_id: ev.period_id, parent_goal_id: null },
        orderBy: { created_at: 'asc' },
      });
      result.push({ ...ev, goals, supervisor_type: isFunctional ? 'functional' : 'business' });
    }
    return result;
  }

  async rejectSelfEvaluation(userId: number, periodId: number, reviewerId: number, reason: string) {
    await this.validateReviewPermission(reviewerId, userId);

    const evaluation = await this.prisma.pbcEvaluation.findUnique({
      where: { user_id_period_id: { user_id: userId, period_id: periodId } },
      include: { user: true, period: true },
    });

    if (!evaluation) throw new NotFoundException('未找到评价记录');
    if (!evaluation.self_submitted_at) throw new BadRequestException('员工尚未提交自评');
    if (evaluation.functional_submitted_at && evaluation.business_submitted_at) {
      throw new BadRequestException('主管已完成评价，无法驳回');
    }

    const updated = await this.prisma.pbcEvaluation.update({
      where: { user_id_period_id: { user_id: userId, period_id: periodId } },
      data: {
        self_submitted_at: null,
        self_eval_reject_reason: reason,
        self_eval_rejected_at: new Date(),
      },
    });

    try {
      if (evaluation.user?.dingtalk_userid) {
        const periodName = evaluation.period
          ? `${evaluation.period.year}年第${evaluation.period.quarter}季度` : '当前周期';
        await this.dingtalkService.sendWorkNotification(
          evaluation.user.organization || '安恒',
          [evaluation.user.dingtalk_userid],
          {
            title: '自评被驳回',
            text: `您 ${periodName} 的自评已被主管驳回，原因：${reason}。请修改后重新提交。`,
            link: 'http://pbc.das-security.cn/pbc',
          },
        );
      }
    } catch (error) {
      console.error('发送钉钉通知失败:', error);
    }

    return { message: '已驳回自评', evaluation: updated };
  }

  private async validateReviewPermission(reviewerId: number, targetUserId: number) {
    const reviewer = await this.prisma.user.findUnique({ where: { user_id: reviewerId } });
    const targetUser = await this.prisma.user.findUnique({ where: { user_id: targetUserId } });

    if (!reviewer || !targetUser) throw new NotFoundException('用户不存在');

    const isFunctionalSupervisor = targetUser.functional_supervisor_id === reviewerId;
    const isBusinessSupervisor = targetUser.business_supervisor_id === reviewerId;

    if (!isFunctionalSupervisor && !isBusinessSupervisor) {
      if (reviewer.role !== 'assistant' || reviewer.department_id !== targetUser.department_id) {
        throw new ForbiddenException('无权审核此目标');
      }
    }
  }

  private async getAllSubordinateIds(userId: number): Promise<number[]> {
    const directSubordinates = await this.prisma.user.findMany({
      where: {
        OR: [
          { functional_supervisor_id: userId },
          { business_supervisor_id: userId },
        ],
      },
    });

    let allIds = directSubordinates.map(s => s.user_id);
    for (const sub of directSubordinates) {
      const subIds = await this.getAllSubordinateIds(sub.user_id);
      allIds = allIds.concat(subIds);
    }
    return allIds;
  }
}
