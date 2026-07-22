import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePerformanceDto } from './dto';
import { DingtalkService } from '../dingtalk/dingtalk.service';
import * as XLSX from 'xlsx';

@Injectable()
export class PerformanceService {
  constructor(
    private prisma: PrismaService,
    private dingtalkService: DingtalkService,
  ) {}

  // 查询绩效列表（按季度筛选 + 权限过滤）
  async getPerformances(periodId?: number, currentUserId?: number) {
    const where: any = {};
    if (periodId) {
      where.period_id = periodId;
    }

    let isBusinessSupervisorOnly = false;

    // 权限过滤
    if (currentUserId) {
      const currentUser = await this.prisma.user.findUnique({
        where: { user_id: currentUserId },
      });

      if (currentUser) {
        const userIds = new Set<number>();

        if (currentUser.role === 'employee') {
          // 检查是否是业务主管或职能主管
          const supervisorSubordinates = await this.prisma.user.findMany({
            where: {
              OR: [
                { functional_supervisor_id: currentUserId },
                { business_supervisor_id: currentUserId },
              ],
            },
            select: { user_id: true, business_supervisor_id: true, functional_supervisor_id: true },
          });

          if (supervisorSubordinates.length > 0) {
            // 主管：看自己 + 作为主管的下属
            userIds.add(currentUserId);
            supervisorSubordinates.forEach(u => userIds.add(u.user_id));
            // 检查是否只是业务主管（用于数据脱敏）：所有下属的业务主管是当前用户，且职能主管不是当前用户
            const isBusinessOnly = supervisorSubordinates.every(
              u => u.business_supervisor_id === currentUserId && u.functional_supervisor_id !== currentUserId
            );
            if (isBusinessOnly) {
              isBusinessSupervisorOnly = true;
            }
          } else {
            // 普通员工只能看自己的已下发绩效
            userIds.add(currentUserId);
            where.result_distributed_at = { not: null };
          }
        } else if (currentUser.role === 'manager') {
          // 经理：本部门 + 作为主管的下属
          if (currentUser.department_id) {
            const deptUsers = await this.prisma.user.findMany({
              where: { department_id: currentUser.department_id },
              select: { user_id: true },
            });
            deptUsers.forEach(u => userIds.add(u.user_id));
          }
          const supervisorSubordinates = await this.prisma.user.findMany({
            where: {
              OR: [
                { functional_supervisor_id: currentUserId },
                { business_supervisor_id: currentUserId },
              ],
            },
            select: { user_id: true },
          });
          supervisorSubordinates.forEach(u => userIds.add(u.user_id));
        } else if (currentUser.role === 'assistant' || currentUser.role === 'gm') {
          // 助理和总经理：部门及子部门 + 作为主管的下属
          const { DepartmentsService } = await import('../departments/departments.service');
          const deptService = new DepartmentsService(this.prisma);
          const rootDeptIds = deptService.getManagedDepartmentIds(currentUser);
          if (rootDeptIds.length > 0) {
            const departmentIds = await deptService.getAllSubDepartmentIds(rootDeptIds);
            const deptUsers = await this.prisma.user.findMany({
              where: { department_id: { in: departmentIds } },
              select: { user_id: true },
            });
            deptUsers.forEach(u => userIds.add(u.user_id));
          }
          const supervisorSubordinates = await this.prisma.user.findMany({
            where: {
              OR: [
                { functional_supervisor_id: currentUserId },
                { business_supervisor_id: currentUserId },
              ],
            },
            select: { user_id: true },
          });
          supervisorSubordinates.forEach(u => userIds.add(u.user_id));
        }

        if (userIds.size > 0) {
          where.user_id = { in: Array.from(userIds) };
        }
      }
    }

    const performances = await this.prisma.pbcPerformance.findMany({
      where,
      include: {
        user: {
          include: { department: true },
        },
        period: true,
        evaluation: true,
      },
      orderBy: [
        { period: { year: 'desc' } },
        { period: { quarter: 'desc' } },
        { user: { real_name: 'asc' } },
      ],
    });

    // 业务主管视角：隐藏职能主管的评分和评价
    if (isBusinessSupervisorOnly) {
      return performances.map(p => ({
        ...p,
        evaluation: p.evaluation ? {
          ...p.evaluation,
          functional_overall_score: null,
          functional_overall_comment: null,
        } : null,
      }));
    }

    return performances;
  }

  // 查询当前用户的绩效（仅已下发的）
  async getMyPerformances(userId: number) {
    return this.prisma.pbcPerformance.findMany({
      where: {
        user_id: userId,
        result_distributed_at: { not: null },
      },
      include: {
        user: {
          include: { department: true },
        },
        period: true,
        evaluation: true,
      },
      orderBy: [
        { period: { year: 'desc' } },
        { period: { quarter: 'desc' } },
      ],
    });
  }

  // 查询单条绩效
  async getPerformance(id: number, currentUserId?: number) {
    const perf = await this.prisma.pbcPerformance.findUnique({
      where: { performance_id: id },
      include: {
        user: {
          include: { department: true },
        },
        period: true,
        evaluation: true,
      },
    });
    if (!perf) {
      throw new NotFoundException('绩效记录不存在');
    }

    // 业务主管视角：隐藏职能主管的评分和评价
    if (currentUserId) {
      const currentUser = await this.prisma.user.findUnique({
        where: { user_id: currentUserId },
      });
      if (currentUser?.role === 'employee' && perf.user.business_supervisor_id === currentUserId) {
        return {
          ...perf,
          evaluation: perf.evaluation ? {
            ...perf.evaluation,
            functional_overall_score: null,
            functional_overall_comment: null,
          } : null,
        };
      }
    }

    return perf;
  }

  // 更新绩效（助理可修改绩效等级，总经理/经理/业务主管可编辑直接下属）
  async updatePerformance(id: number, dto: UpdatePerformanceDto, currentUserId: number, currentRole: string) {
    const perf = await this.prisma.pbcPerformance.findUnique({
      where: { performance_id: id },
      include: { user: true },
    });
    if (!perf) {
      throw new NotFoundException('绩效记录不存在');
    }

    if (currentRole === 'assistant') {
      // 助理可以修改绩效等级
    } else if (currentRole === 'gm' || currentRole === 'manager') {
      const isSupervisor = perf.user.functional_supervisor_id === currentUserId || perf.user.business_supervisor_id === currentUserId;
      if (!isSupervisor) {
        throw new ForbiddenException('只能编辑直接下属的绩效');
      }
    } else if (currentRole === 'employee') {
      // 业务主管（普通员工角色）可以编辑自己作为业务主管的下属绩效
      if (perf.user.business_supervisor_id !== currentUserId) {
        throw new ForbiddenException('只能编辑自己下属的绩效');
      }
    } else {
      throw new ForbiddenException('无权编辑绩效');
    }

    return this.prisma.pbcPerformance.update({
      where: { performance_id: id },
      data: {
        performance_level: dto.performance_level,
        has_ai_contribution: dto.has_ai_contribution,
        ai_performance_comment: dto.ai_performance_comment,
        bottom_mgmt_status: dto.bottom_mgmt_status,
        planned_elimination_date: dto.planned_elimination_date
          ? new Date(dto.planned_elimination_date)
          : undefined,
      },
      include: {
        user: {
          include: { department: true },
        },
        period: true,
        evaluation: true,
      },
    });
  }

  // 导出绩效为Excel
  async exportToExcel(periodId?: number, currentUserId?: number): Promise<Buffer> {
    const list = await this.getPerformances(periodId, currentUserId);

    const rows = list.map((item: any) => ({
      '姓名': item.user?.real_name || '',
      '部门': item.user?.department?.department_name || '',
      '季度': `${item.period?.year}Q${item.period?.quarter}`,
      '绩效等级': item.performance_level || '',
      '绩效评价': item.performance_comment || '',
      '是否有AI维度的组织贡献': item.has_ai_contribution === true ? '是' : item.has_ai_contribution === false ? '否' : '',
      'AI维度绩效评价': item.ai_performance_comment || '',
      '末位管理执行状态': item.bottom_mgmt_status || '',
      '拟淘汰时间': item.planned_elimination_date
        ? new Date(item.planned_elimination_date).toISOString().slice(0, 10)
        : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    // 设置列宽
    ws['!cols'] = [
      { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
      { wch: 30 }, { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '绩效管理');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // 自动生成绩效记录（主管提交评价后调用）
  async generatePerformance(userId: number, periodId: number, evaluationId: number) {
    // 查看是否已存在
    const existing = await this.prisma.pbcPerformance.findUnique({
      where: {
        user_id_period_id: { user_id: userId, period_id: periodId },
      },
    });
    if (existing) {
      return existing;
    }

    // 获取评价信息
    const evaluation = await this.prisma.pbcEvaluation.findUnique({
      where: { evaluation_id: evaluationId },
    });

    // 根据加权平均分自动计算绩效等级
    let performanceLevel: string | null = null;
    if (evaluation?.avg_weighted_score != null) {
      const score = Number(evaluation.avg_weighted_score);
      if (score >= 95) {
        performanceLevel = 'S';
      } else if (score >= 85) {
        performanceLevel = 'A';
      } else if (score >= 70) {
        performanceLevel = 'B';
      } else if (score >= 55) {
        performanceLevel = 'C';
      } else {
        performanceLevel = 'D';
      }
    }

    return this.prisma.pbcPerformance.create({
      data: {
        user_id: userId,
        period_id: periodId,
        evaluation_id: evaluationId,
        performance_level: performanceLevel,
        performance_comment: evaluation?.functional_overall_comment || evaluation?.business_overall_comment || null,
      },
    });
  }

  // 下发绩效结果（助理操作）
  async distributeResults(performanceIds: number[], currentUserId: number, currentRole: string) {
    if (currentRole !== 'assistant') {
      throw new ForbiddenException('仅助理可以下发绩效结果');
    }

    const performances = await this.prisma.pbcPerformance.findMany({
      where: { performance_id: { in: performanceIds } },
      include: {
        user: true,
        period: true,
      },
    });

    const now = new Date();
    await this.prisma.pbcPerformance.updateMany({
      where: { performance_id: { in: performanceIds } },
      data: { result_distributed_at: now },
    });

    // 发送钉钉通知
    for (const perf of performances) {
      try {
        if (perf.user.dingtalk_userid) {
          const periodName = perf.period
            ? `${perf.period.year}年第${perf.period.quarter}季度`
            : '当前周期';
          await this.dingtalkService.sendPerformanceDistributedNotification(
            perf.user.organization || '安恒',
            perf.user.dingtalk_userid,
            periodName,
          );
        }
      } catch (err) {
        console.error(`发送绩效结果通知失败 userId=${perf.user_id}:`, err);
      }
    }

    return { count: performances.length, message: `已成功下发 ${performances.length} 条绩效结果` };
  }
}
