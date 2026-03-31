import { Controller, Get, Put, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { UpdatePerformanceDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('performance')
@UseGuards(JwtAuthGuard)
export class PerformanceController {
  constructor(private performanceService: PerformanceService) {}

  // 获取绩效列表（可按季度筛选）
  @Get()
  async getPerformances(@Query('periodId') periodId?: string) {
    return this.performanceService.getPerformances(
      periodId ? +periodId : undefined,
    );
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
}
