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

  // 导出绩效为Excel
  async exportToExcel(periodId?: number): Promise<Buffer> {
    const list = await this.getPerformances(periodId);

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

    return this.prisma.pbcPerformance.create({
      data: {
        user_id: userId,
        period_id: periodId,
        evaluation_id: evaluationId,
        performance_comment: evaluation?.supervisor_overall_comment || null,
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
