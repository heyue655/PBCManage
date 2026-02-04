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
    @Query('periodId') periodId?: number,
  ) {
    return this.pbcService.getSupervisorGoals(req.user.userId, periodId);
  }

  // 获取团队目标（根据权限）
  @Get('team-goals')
  async getTeamGoals(
    @Request() req: any,
    @Query('periodId') periodId?: number,
  ) {
    return this.pbcService.getTeamGoals(req.user.userId, periodId);
  }

  // 获取用户PBC统计
  @Get('summary')
  async getUserPbcSummary(
    @Request() req: any,
    @Query('periodId') periodId?: number,
  ) {
    return this.pbcService.getUserPbcSummary(req.user.userId, periodId);
  }

  // PBC目标CRUD
  @Get()
  async findAll(
    @Request() req: any,
    @Query('userId') userId?: number,
    @Query('year') year?: number,
    @Query('quarter') quarter?: number,
    @Query('status') status?: PbcStatus,
    @Query('goalType') goalType?: GoalType,
  ) {
    // 如果没有指定userId，默认查询当前用户的
    const targetUserId = userId || req.user.userId;
    return this.pbcService.findAll({
      userId: targetUserId,
      year,
      quarter,
      status,
      goalType,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.pbcService.findOne(id);
  }

  @Post()
  async create(@Request() req: any, @Body() createPbcDto: CreatePbcDto) {
    return this.pbcService.create(req.user.userId, createPbcDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Request() req: any,
    @Body() updatePbcDto: UpdatePbcDto,
  ) {
    return this.pbcService.update(id, req.user.userId, updatePbcDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: number, @Request() req: any) {
    return this.pbcService.delete(id, req.user.userId);
  }

  // 批量提交审核（提交当前周期所有草稿状态目标）
  @Post('submit')
  async submitAll(
    @Request() req: any,
    @Query('periodId') periodId?: number,
  ) {
    return this.pbcService.submitAll(req.user.userId, periodId);
  }

  // 子目标
  @Post(':id/sub-goals')
  async createSubGoal(
    @Param('id') parentId: number,
    @Request() req: any,
    @Body() createPbcDto: CreatePbcDto,
  ) {
    return this.pbcService.createSubGoal(parentId, req.user.userId, createPbcDto);
  }

  // 自评
  @Post(':id/self-evaluate')
  async selfEvaluate(
    @Param('id') id: number,
    @Request() req: any,
    @Body() selfEvaluateDto: SelfEvaluateDto,
  ) {
    return this.pbcService.selfEvaluate(
      id,
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
    @Param('userId') userId: number,
    @Param('periodId') periodId: number,
  ) {
    return this.pbcService.getEvaluation(userId, periodId);
  }

  // 主管评价单个目标
  @Post(':id/supervisor-evaluate')
  async supervisorEvaluate(
    @Param('id') id: number,
    @Request() req: any,
    @Body() body: { score: number; comment: string },
  ) {
    return this.pbcService.supervisorEvaluate(
      id,
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
