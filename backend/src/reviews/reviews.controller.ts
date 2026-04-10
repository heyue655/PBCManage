import { Controller, Get, Post, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ApproveDto, RejectDto, SupervisorEvaluateDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  // 获取待审核数量（用于菜单角标）
  @Get('pending-count')
  async getPendingCount(@Request() req: any) {
    const pending = await this.reviewsService.getPendingReviews(req.user.userId);
    const pendingEvals = await this.reviewsService.getPendingEvaluations(req.user.userId);
    return { count: pending.length + pendingEvals.length };
  }

  // 获取待审核列表
  @Get('pending')
  async getPendingReviews(@Request() req: any) {
    return this.reviewsService.getPendingReviews(req.user.userId);
  }

  // 获取待评价列表（员工已提交自评）
  @Get('pending-evaluations')
  async getPendingEvaluations(@Request() req: any) {
    return this.reviewsService.getPendingEvaluations(req.user.userId);
  }

  // 获取下属历史记录
  @Get('history')
  async getSubordinatesHistory(
    @Request() req: any,
    @Query('year') year?: string,
    @Query('quarter') quarter?: string,
  ) {
    return this.reviewsService.getSubordinatesHistory(req.user.userId, { year: year ? +year : undefined, quarter: quarter ? +quarter : undefined });
  }

  // 获取审批历史
  @Get(':goalId/approvals')
  async getApprovalHistory(@Param('goalId') goalId: string) {
    return this.reviewsService.getApprovalHistory(+goalId);
  }

  // 驳回自评（放在 :goalId 路由之前避免匹配冲突）
  @Post('reject-self-evaluation')
  async rejectSelfEvaluation(
    @Request() req: any,
    @Body() body: { userId: number; periodId: number; reason: string },
  ) {
    return this.reviewsService.rejectSelfEvaluation(
      body.userId,
      body.periodId,
      req.user.userId,
      body.reason,
    );
  }

  // 通过审核
  @Post(':goalId/approve')
  async approve(
    @Param('goalId') goalId: string,
    @Request() req: any,
    @Body() approveDto: ApproveDto,
  ) {
    return this.reviewsService.approve(+goalId, req.user.userId, approveDto);
  }

  // 驳回审核
  @Post(':goalId/reject')
  async reject(
    @Param('goalId') goalId: string,
    @Request() req: any,
    @Body() rejectDto: RejectDto,
  ) {
    return this.reviewsService.reject(+goalId, req.user.userId, rejectDto);
  }

  // 归档
  @Post(':goalId/archive')
  async archive(@Param('goalId') goalId: string, @Request() req: any) {
    return this.reviewsService.archive(+goalId, req.user.userId);
  }

  // 主管评估
  @Post(':goalId/supervisor-evaluate')
  async supervisorEvaluate(
    @Param('goalId') goalId: string,
    @Request() req: any,
    @Body() evaluateDto: SupervisorEvaluateDto,
  ) {
    return this.reviewsService.supervisorEvaluate(+goalId, req.user.userId, evaluateDto);
  }
}
