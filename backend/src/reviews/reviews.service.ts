import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveDto, RejectDto, SupervisorEvaluateDto } from './dto';
import { DingtalkService } from '../dingtalk/dingtalk.service';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private dingtalkService: DingtalkService,
  ) {}

  // 获取待审核列表
  async getPendingReviews(supervisorId: number) {
    const subordinates = await this.prisma.user.findMany({
      where: { supervisor_id: supervisorId },
    });

    if (subordinates.length === 0) {
      return [];
    }

    const subordinateIds = subordinates.map(s => s.user_id);

    return this.prisma.pbcGoal.findMany({
      where: {
        user_id: { in: subordinateIds },
        status: 'submitted',
        parent_goal_id: null,
      },
      include: {
        user: true,
        period: true,
        subGoals: true,
      },
    });
  }

  // 批量通过审核（通过员工当前周期所有已提交的目标）
  async approve(goalId: number, reviewerId: number, approveDto: ApproveDto) {
    // 先获取其中一个目标，用于获取员工ID和周期信息
    const sampleGoal = await this.prisma.pbcGoal.findUnique({
      where: { goal_id: goalId },
      include: { user: true, period: true },
    });

    if (!sampleGoal) {
      throw new NotFoundException('目标不存在');
    }

    await this.validateReviewPermission(reviewerId, sampleGoal.user_id);

    if (sampleGoal.status !== 'submitted') {
      throw new BadRequestException('当前状态不允许审核');
    }

    // 查找该员工当前周期所有已提交的主目标
    const allGoals = await this.prisma.pbcGoal.findMany({
      where: {
        user_id: sampleGoal.user_id,
        period_id: sampleGoal.period_id,
        status: 'submitted',
        parent_goal_id: null,
      },
      include: { subGoals: true },
    });

    if (allGoals.length === 0) {
      throw new BadRequestException('没有待审核的目标');
    }

    const goalIds = allGoals.map(g => g.goal_id);

    // 批量更新所有主目标
    await this.prisma.pbcGoal.updateMany({
      where: {
        goal_id: { in: goalIds },
      },
      data: { status: 'approved' },
    });

    // 批量更新所有子目标
    const allSubGoalIds = allGoals.flatMap(g => g.subGoals?.map(sg => sg.goal_id) || []);
    if (allSubGoalIds.length > 0) {
      await this.prisma.pbcGoal.updateMany({
        where: {
          goal_id: { in: allSubGoalIds },
        },
        data: { status: 'approved' },
      });
    }

    // 为每个主目标记录审批
    for (const goal of allGoals) {
      await this.prisma.pbcApproval.create({
        data: {
          goal_id: goal.goal_id,
          reviewer_id: reviewerId,
          action: 'approve',
          comments: approveDto.comments,
        },
      });
    }

    // 发送钉钉通知给员工
    try {
      if (sampleGoal.user.dingtalk_userid) {
        const periodName = sampleGoal.period 
          ? `${sampleGoal.period.year}年第${sampleGoal.period.quarter}季度` 
          : '当前周期';
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
      // 通知失败不影响主流程
    }

    return {
      message: `成功通过 ${allGoals.length} 个目标`,
      count: allGoals.length,
      goals: allGoals.map(g => ({
        goal_id: g.goal_id,
        goal_name: g.goal_name,
      })),
    };
  }

  // 批量驳回审核（驳回员工当前周期所有已提交的目标）
  async reject(goalId: number, reviewerId: number, rejectDto: RejectDto) {
    // 先获取其中一个目标，用于获取员工ID和周期信息
    const sampleGoal = await this.prisma.pbcGoal.findUnique({
      where: { goal_id: goalId },
      include: { user: true, period: true },
    });

    if (!sampleGoal) {
      throw new NotFoundException('目标不存在');
    }

    await this.validateReviewPermission(reviewerId, sampleGoal.user_id);

    if (sampleGoal.status !== 'submitted') {
      throw new BadRequestException('当前状态不允许审核');
    }

    // 查找该员工当前周期所有已提交的主目标
    const allGoals = await this.prisma.pbcGoal.findMany({
      where: {
        user_id: sampleGoal.user_id,
        period_id: sampleGoal.period_id,
        status: 'submitted',
        parent_goal_id: null,
      },
      include: { subGoals: true },
    });

    if (allGoals.length === 0) {
      throw new BadRequestException('没有待审核的目标');
    }

    const goalIds = allGoals.map(g => g.goal_id);

    // 批量更新所有主目标
    await this.prisma.pbcGoal.updateMany({
      where: {
        goal_id: { in: goalIds },
      },
      data: { status: 'rejected' },
    });

    // 批量更新所有子目标
    const allSubGoalIds = allGoals.flatMap(g => g.subGoals?.map(sg => sg.goal_id) || []);
    if (allSubGoalIds.length > 0) {
      await this.prisma.pbcGoal.updateMany({
        where: {
          goal_id: { in: allSubGoalIds },
        },
        data: { status: 'rejected' },
      });
    }

    // 为每个主目标记录审批
    for (const goal of allGoals) {
      await this.prisma.pbcApproval.create({
        data: {
          goal_id: goal.goal_id,
          reviewer_id: reviewerId,
          action: 'reject',
          comments: rejectDto.reason,
        },
      });
    }

    // 发送钉钉通知给员工
    try {
      if (sampleGoal.user.dingtalk_userid) {
        const periodName = sampleGoal.period 
          ? `${sampleGoal.period.year}年第${sampleGoal.period.quarter}季度` 
          : '当前周期';
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
      // 通知失败不影响主流程
    }

    return {
      message: `已驳回 ${allGoals.length} 个目标`,
      count: allGoals.length,
      reason: rejectDto.reason,
      goals: allGoals.map(g => ({
        goal_id: g.goal_id,
        goal_name: g.goal_name,
      })),
    };
  }

  // 归档
  async archive(goalId: number, reviewerId: number) {
    const goal = await this.prisma.pbcGoal.findUnique({
      where: { goal_id: goalId },
      include: { user: true, subGoals: true },
    });

    if (!goal) {
      throw new NotFoundException('目标不存在');
    }

    await this.validateReviewPermission(reviewerId, goal.user_id);

    if (goal.status !== 'approved') {
      throw new BadRequestException('只能归档已通过的目标');
    }

    // 更新主目标
    const updatedGoal = await this.prisma.pbcGoal.update({
      where: { goal_id: goalId },
      data: { status: 'archived' },
    });

    // 更新子目标
    if (goal.subGoals && goal.subGoals.length > 0) {
      await this.prisma.pbcGoal.updateMany({
        where: {
          parent_goal_id: goalId,
        },
        data: { status: 'archived' },
      });
    }

    return { message: '已归档', goal: updatedGoal };
  }

  // 主管评估
  async supervisorEvaluate(goalId: number, reviewerId: number, evaluateDto: SupervisorEvaluateDto) {
    const goal = await this.prisma.pbcGoal.findUnique({
      where: { goal_id: goalId },
      include: { user: true },
    });

    if (!goal) {
      throw new NotFoundException('目标不存在');
    }

    await this.validateReviewPermission(reviewerId, goal.user_id);

    if (goal.status !== 'archived') {
      throw new BadRequestException('只能对已归档的目标进行评估');
    }

    return this.prisma.pbcGoal.update({
      where: { goal_id: goalId },
      data: {
        supervisor_score: evaluateDto.score,
        supervisor_comment: evaluateDto.comment || '',
      },
    });
  }

  // 获取审批历史
  async getApprovalHistory(goalId: number) {
    return this.prisma.pbcApproval.findMany({
      where: { goal_id: goalId },
      include: { reviewer: true },
      orderBy: { created_at: 'desc' },
    });
  }

  // 获取下属的历史记录
  async getSubordinatesHistory(supervisorId: number, query: { year?: number; quarter?: number }) {
    const allSubordinateIds = await this.getAllSubordinateIds(supervisorId);

    if (allSubordinateIds.length === 0) {
      return [];
    }

    const where: any = {
      user_id: { in: allSubordinateIds },
      parent_goal_id: null,
    };

    if (query.year || query.quarter) {
      where.period = {};
      if (query.year) where.period.year = query.year;
      if (query.quarter) where.period.quarter = query.quarter;
    }

    return this.prisma.pbcGoal.findMany({
      where,
      include: {
        user: true,
        period: true,
      },
    });
  }

  // 获取待评价列表（员工已提交自评，主管未评价）——仅直接下属
  async getPendingEvaluations(supervisorId: number) {
    const directSubordinates = await this.prisma.user.findMany({
      where: { supervisor_id: supervisorId },
    });
    const allSubordinateIds = directSubordinates.map(s => s.user_id);
    if (allSubordinateIds.length === 0) return [];

    const evaluations = await this.prisma.pbcEvaluation.findMany({
      where: {
        user_id: { in: allSubordinateIds },
        self_submitted_at: { not: null },
        supervisor_submitted_at: null,
      },
      include: {
        user: {
          select: {
            user_id: true,
            real_name: true,
            department: { select: { department_name: true } },
          },
        },
        period: true,
      },
    });

    // 为每个评价附带目标数据
    const result = [];
    for (const ev of evaluations) {
      const goals = await this.prisma.pbcGoal.findMany({
        where: {
          user_id: ev.user_id,
          period_id: ev.period_id,
          parent_goal_id: null,
        },
        orderBy: { created_at: 'asc' },
      });
      result.push({ ...ev, goals });
    }
    return result;
  }

  // 驳回自评
  async rejectSelfEvaluation(
    userId: number,
    periodId: number,
    reviewerId: number,
    reason: string,
  ) {
    await this.validateReviewPermission(reviewerId, userId);

    const evaluation = await this.prisma.pbcEvaluation.findUnique({
      where: { user_id_period_id: { user_id: userId, period_id: periodId } },
      include: { user: true, period: true },
    });

    if (!evaluation) {
      throw new NotFoundException('未找到评价记录');
    }

    if (!evaluation.self_submitted_at) {
      throw new BadRequestException('员工尚未提交自评');
    }

    if (evaluation.supervisor_submitted_at) {
      throw new BadRequestException('主管已完成评价，无法驳回');
    }

    // 清除 self_submitted_at，保留目标级别的自评分数/说明供员工修改
    const updated = await this.prisma.pbcEvaluation.update({
      where: { user_id_period_id: { user_id: userId, period_id: periodId } },
      data: {
        self_submitted_at: null,
        self_eval_reject_reason: reason,
        self_eval_rejected_at: new Date(),
      },
    });

    // 发送钉钉通知
    try {
      if (evaluation.user?.dingtalk_userid) {
        const periodName = evaluation.period
          ? `${evaluation.period.year}年第${evaluation.period.quarter}季度`
          : '当前周期';
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

  // 验证审核权限
  private async validateReviewPermission(reviewerId: number, targetUserId: number) {
    const reviewer = await this.prisma.user.findUnique({
      where: { user_id: reviewerId },
    });

    const targetUser = await this.prisma.user.findUnique({
      where: { user_id: targetUserId },
    });

    if (!reviewer || !targetUser) {
      throw new NotFoundException('用户不存在');
    }

    if (targetUser.supervisor_id !== reviewerId) {
      if (reviewer.role !== 'assistant' || reviewer.department_id !== targetUser.department_id) {
        throw new ForbiddenException('无权审核此目标');
      }
    }
  }

  // 递归获取所有下属ID
  private async getAllSubordinateIds(userId: number): Promise<number[]> {
    const directSubordinates = await this.prisma.user.findMany({
      where: { supervisor_id: userId },
    });

    let allIds = directSubordinates.map(s => s.user_id);

    for (const sub of directSubordinates) {
      const subIds = await this.getAllSubordinateIds(sub.user_id);
      allIds = allIds.concat(subIds);
    }

    return allIds;
  }
}
