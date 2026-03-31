import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePerformanceDto } from './dto';

@Injectable()
export class PerformanceService {
  constructor(private prisma: PrismaService) {}

  // 查询绩效列表（按季度筛选）
  async getPerformances(periodId?: number) {
    const where: any = {};
    if (periodId) {
      where.period_id = periodId;
    }

    return this.prisma.pbcPerformance.findMany({
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
  }

  // 查询单条绩效
  async getPerformance(id: number) {
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
    return perf;
  }

  // 更新绩效（仅总经理可编辑直接下属）
  async updatePerformance(id: number, dto: UpdatePerformanceDto, currentUserId: number, currentRole: string) {
    if (currentRole === 'assistant') {
      throw new ForbiddenException('助理仅有查看权限，不允许编辑');
    }

    const perf = await this.prisma.pbcPerformance.findUnique({
      where: { performance_id: id },
      include: { user: true },
    });
    if (!perf) {
      throw new NotFoundException('绩效记录不存在');
    }

    // 总经理只能编辑直接下属的绩效
    if (currentRole === 'gm') {
      if (perf.user.supervisor_id !== currentUserId) {
        throw new ForbiddenException('只能编辑直接下属的绩效');
      }
    } else {
      // manager 等其他角色也只能编辑直接下属
      if (perf.user.supervisor_id !== currentUserId) {
        throw new ForbiddenException('只能编辑直接下属的绩效');
      }
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

    return this.prisma.pbcPerformance.create({
      data: {
        user_id: userId,
        period_id: periodId,
        evaluation_id: evaluationId,
        performance_comment: evaluation?.supervisor_overall_comment || null,
      },
    });
  }
}
