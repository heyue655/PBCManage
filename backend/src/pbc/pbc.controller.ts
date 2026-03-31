import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { PbcService } from './pbc.service';
import { CreatePbcDto, UpdatePbcDto, CreatePeriodDto, SelfEvaluateDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PbcStatus, GoalType } from '../entities';

@Controller('pbc')
@UseGuards(JwtAuthGuard)
export class PbcController {
  constructor(private pbcService: PbcService) {}

  // 周期管理
  @Get('periods')
  async findAllPeriods() {
    return this.pbcService.findAllPeriods();
  }

  @Get('periods/active')
  async findActivePeriod() {
    return this.pbcService.findActivePeriod();
  }

  @Post('periods')
  async createPeriod(@Body() createPeriodDto: CreatePeriodDto) {
    return this.pbcService.createPeriod(createPeriodDto);
  }

  // 获取上级目标
  @Get('supervisor-goals')
  async getSupervisorGoals(
    @Request() req: any,
    @Query('periodId') periodId?: string,
  ) {
    return this.pbcService.getSupervisorGoals(req.user.userId, periodId ? +periodId : undefined);
  }

  // 获取团队目标（根据权限）
  @Get('team-goals')
  async getTeamGoals(
    @Request() req: any,
    @Query('periodId') periodId?: string,
  ) {
    return this.pbcService.getTeamGoals(req.user.userId, periodId ? +periodId : undefined);
  }

  // 获取用户PBC统计
  @Get('summary')
  async getUserPbcSummary(
    @Request() req: any,
    @Query('periodId') periodId?: string,
  ) {
    return this.pbcService.getUserPbcSummary(req.user.userId, periodId ? +periodId : undefined);
  }

  // ====== 任务下发相关（必须在 :id 路由之前） ======

  // 下发任务（助理/总经理）
  @Post('tasks')
  async createTasks(
    @Request() req: any,
    @Body() body: { userIds: number[]; periodId: number },
  ) {
    return this.pbcService.createTasks(req.user.userId, body.userIds, body.periodId);
  }

  // 获取任务列表（我的任务 or 团队任务）
  @Get('tasks')
  async getTasks(
    @Request() req: any,
    @Query('mode') mode?: string,
    @Query('periodId') periodId?: string,
  ) {
    if (mode === 'team') {
      return this.pbcService.getTeamTasks(req.user.userId, periodId ? +periodId : undefined);
    }
    return this.pbcService.getMyTasks(req.user.userId);
  }

  // 获取单个任务详情
  @Get('tasks/:taskId')
  async getTaskDetail(
    @Param('taskId') taskId: string,
    @Request() req: any,
  ) {
    return this.pbcService.getTaskDetail(+taskId, req.user.userId);
  }

  // PBC目标CRUD
  @Get()
  async findAll(
    @Request() req: any,
    @Query('userId') userId?: string,
    @Query('year') year?: string,
    @Query('quarter') quarter?: string,
    @Query('status') status?: PbcStatus,
    @Query('goalType') goalType?: GoalType,
  ) {
    // 如果没有指定userId，默认查询当前用户的
    const targetUserId = userId ? +userId : req.user.userId;
    return this.pbcService.findAll({
      userId: targetUserId,
      year: year ? +year : undefined,
      quarter: quarter ? +quarter : undefined,
      status,
      goalType,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.pbcService.findOne(+id);
  }

  @Post()
  async create(@Request() req: any, @Body() createPbcDto: CreatePbcDto) {
    return this.pbcService.create(req.user.userId, createPbcDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updatePbcDto: UpdatePbcDto,
  ) {
    return this.pbcService.update(+id, req.user.userId, updatePbcDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.pbcService.delete(+id, req.user.userId);
  }

  // 批量提交审核（提交当前周期所有草稿状态目标）
  @Post('submit')
  async submitAll(
    @Request() req: any,
    @Query('periodId') periodId?: string,
  ) {
    return this.pbcService.submitAll(req.user.userId, periodId ? +periodId : undefined);
  }

  // 子目标
  @Post(':id/sub-goals')
  async createSubGoal(
    @Param('id') parentId: string,
    @Request() req: any,
    @Body() createPbcDto: CreatePbcDto,
  ) {
    return this.pbcService.createSubGoal(+parentId, req.user.userId, createPbcDto);
  }

  // 自评
  @Post(':id/self-evaluate')
  async selfEvaluate(
    @Param('id') id: string,
    @Request() req: any,
    @Body() selfEvaluateDto: SelfEvaluateDto,
  ) {
    return this.pbcService.selfEvaluate(
      +id,
      req.user.userId,
      selfEvaluateDto.score,
      selfEvaluateDto.comment || '',
    );
  }

  // 提交整体自评
  @Post('submit-self-evaluation')
  async submitSelfEvaluation(
    @Request() req: any,
    @Body() body: { periodId: number; overallComment: string },
  ) {
    return this.pbcService.submitSelfEvaluation(
      req.user.userId,
      body.periodId,
      body.overallComment,
    );
  }

  // 获取评价信息
  @Get('evaluation/:userId/:periodId')
  async getEvaluation(
    @Param('userId') userId: string,
    @Param('periodId') periodId: string,
  ) {
    return this.pbcService.getEvaluation(+userId, +periodId);
  }

  // 主管评价单个目标
  @Post(':id/supervisor-evaluate')
  async supervisorEvaluate(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { score: number; comment: string },
  ) {
    return this.pbcService.supervisorEvaluate(
      +id,
      req.user.userId,
      body.score,
      body.comment,
    );
  }

  // 提交整体主管评价
  @Post('submit-supervisor-evaluation')
  async submitSupervisorEvaluation(
    @Request() req: any,
    @Body() body: { userId: number; periodId: number; overallComment: string },
  ) {
    return this.pbcService.submitSupervisorEvaluation(
      body.userId,
      body.periodId,
      req.user.userId,
      body.overallComment,
    );
  }
}
