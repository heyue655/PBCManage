import { Controller, Get, Post, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ApproveDto, RejectDto, SupervisorEvaluateDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  // 获取待审核列表
  @Get('pending')
  async getPendingReviews(@Request() req: any) {
    return this.reviewsService.getPendingReviews(req.user.userId);
  }

  // 获取下属历史记录
  @Get('history')
  async getSubordinatesHistory(
    @Request() req: any,
    @Query('year') year?: number,
    @Query('quarter') quarter?: number,
  ) {
    return this.reviewsService.getSubordinatesHistory(req.user.userId, { year, quarter });
  }

  // 获取审批历史
  @Get(':goalId/approvals')
  async getApprovalHistory(@Param('goalId') goalId: number) {
    return this.reviewsService.getApprovalHistory(goalId);
  }

  // 通过审核
  @Post(':goalId/approve')
  async approve(
    @Param('goalId') goalId: number,
    @Request() req: any,
    @Body() approveDto: ApproveDto,
  ) {
    return this.reviewsService.approve(goalId, req.user.userId, approveDto);
  }

  // 驳回审核
  @Post(':goalId/reject')
  async reject(
    @Param('goalId') goalId: number,
    @Request() req: any,
    @Body() rejectDto: RejectDto,
  ) {
    return this.reviewsService.reject(goalId, req.user.userId, rejectDto);
  }

  // 归档
  @Post(':goalId/archive')
  async archive(@Param('goalId') goalId: number, @Request() req: any) {
    return this.reviewsService.archive(goalId, req.user.userId);
  }

  // 主管评估
  @Post(':goalId/supervisor-evaluate')
  async supervisorEvaluate(
    @Param('goalId') goalId: number,
    @Request() req: any,
    @Body() evaluateDto: SupervisorEvaluateDto,
  ) {
    return this.reviewsService.supervisorEvaluate(goalId, req.user.userId, evaluateDto);
  }
}
