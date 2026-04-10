import { Controller, Get, Put, Post, Param, Query, Body, UseGuards, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { PerformanceService } from './performance.service';
import { UpdatePerformanceDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('performance')
@UseGuards(JwtAuthGuard)
export class PerformanceController {
  constructor(private performanceService: PerformanceService) {}

  // 获取当前用户的绩效（我的绩效，仅已下发的）
  @Get('mine')
  async getMyPerformances(@Request() req: any) {
    return this.performanceService.getMyPerformances(req.user.userId);
  }

  // 获取绩效列表（可按季度筛选）
  @Get()
  async getPerformances(@Request() req: any, @Query('periodId') periodId?: string) {
    return this.performanceService.getPerformances(
      periodId ? +periodId : undefined,
      req.user.userId,
    );
  }

  // 导出绩效为Excel（放在 :id 之前避免路由冲突）
  @Get('export')
  async exportPerformances(
    @Request() req: any,
    @Query('periodId') periodId: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.performanceService.exportToExcel(
      periodId ? +periodId : undefined,
      req.user.userId,
    );
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=performance.xlsx',
    });
    res.send(buffer);
  }

  // 获取单条绩效详情
  @Get(':id')
  async getPerformance(@Param('id') id: string) {
    return this.performanceService.getPerformance(+id);
  }

  // 更新绩效（仅总经理可编辑直接下属）
  @Put(':id')
  async updatePerformance(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdatePerformanceDto,
  ) {
    return this.performanceService.updatePerformance(
      +id,
      dto,
      req.user.userId,
      req.user.role,
    );
  }

  // 下发绩效结果（仅助理）
  @Post('distribute')
  async distributeResults(
    @Request() req: any,
    @Body() body: { performanceIds: number[] },
  ) {
    return this.performanceService.distributeResults(
      body.performanceIds,
      req.user.userId,
      req.user.role,
    );
  }
}
