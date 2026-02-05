import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePbcDto, UpdatePbcDto, CreatePeriodDto } from './dto';
import { DingtalkService } from '../dingtalk/dingtalk.service';

@Injectable()
export class PbcService {
  constructor(
    private prisma: PrismaService,
    private dingtalkService: DingtalkService,
  ) {}

  // 周期管理
  async createPeriod(createPeriodDto: CreatePeriodDto) {
    return this.prisma.pbcPeriod.create({
      data: createPeriodDto,
    });
  }

  async findAllPeriods() {
    return this.prisma.pbcPeriod.findMany({
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
    });
  }

  async findActivePeriod() {
    return this.prisma.pbcPeriod.findFirst({
      where: { status: 'active' },
    });
  }

  // PBC目标管理
  async create(userId: number, createPbcDto: CreatePbcDto) {
    console.log('\n=== 创建PBC目标开始 ===');
    console.log('用户ID:', userId);
    console.log('接收到的DTO:', JSON.stringify(createPbcDto, null, 2));

    // 查询用户角色和主管信息
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      include: { supervisor: true },
    });

    console.log('用户信息:', {
      user_id: user?.user_id,
      username: user?.username,
      real_name: user?.real_name,
      role: user?.role,
      supervisor_id: user?.supervisor_id,
    });

    if (!user) {
      console.log('❌ 用户不存在');
      throw new NotFoundException('用户不存在');
    }

    // 验证目标类型权限：普通员工不能创建团队目标
    if (user.role === 'employee' && createPbcDto.goal_type === 'team') {
      console.log('❌ 普通员工不能创建团队目标');
      throw new BadRequestException('普通员工不能创建组织与人员管理&团队建设目标，只能创建业务目标和个人能力提升目标');
    }

    console.log('✓ 目标类型验证通过');

    // 验证上级目标关联（仅对业务目标且非总经理）
    if (createPbcDto.goal_type === 'business') {
      console.log('>> 验证业务目标的上级关联');
      if (user.role !== 'gm') {
        console.log('   用户角色:', user.role, '- 需要关联上级目标');
        // 非总经理的业务目标必须关联上级的业务目标
        if (!createPbcDto.supervisor_goal_id) {
          console.log('❌ 缺少上级目标关联');
          // throw new BadRequestException('业务目标必须关联上级的业务目标');
        }

        console.log('   supervisor_goal_id:', createPbcDto.supervisor_goal_id);

        // 验证关联的上级目标是否存在且属于上级主管
        if (user.supervisor_id) {
          console.log('   正在验证上级目标...');
          const supervisorGoal = await this.prisma.pbcGoal.findFirst({
            where: {
              goal_id: createPbcDto.supervisor_goal_id,
              user_id: user.supervisor_id,
              goal_type: 'business', // 关联上级的业务目标
              parent_goal_id: null,
            },
          });

          console.log('   上级目标查询结果:', supervisorGoal ? '找到' : '未找到');

          if (!supervisorGoal) {
            console.log('❌ 关联的上级目标不存在或不是有效的业务目标');
            // throw new BadRequestException('关联的上级目标不存在或不是有效的业务目标');
          }
        }
        console.log('✓ 上级目标验证通过');
      } else {
        console.log('   用户角色: 总经理 - 不需要关联上级目标');
        // 总经理不应该有上级目标关联
        if (createPbcDto.supervisor_goal_id) {
          console.log('❌ 总经理不应该关联上级目标');
          throw new BadRequestException('总经理创建目标时不应关联上级目标');
        }
      }
    } else {
      console.log('>> 目标类型为', createPbcDto.goal_type, '- 不需要关联上级目标');
    }

    // 总经理创建的目标无需审批，直接设置为已通过
    const status = user.role === 'gm' ? 'approved' : 'draft';
    console.log('目标状态:', status);

    // 准备创建数据，个人能力提升和团队目标不关联上级目标
    const createData: any = {
      user_id: userId,
      period_id: createPbcDto.period_id,
      goal_type: createPbcDto.goal_type,
      goal_name: createPbcDto.goal_name,
      goal_description: createPbcDto.goal_description,
      goal_weight: createPbcDto.goal_weight,
      status,
    };

    // 只有业务目标才关联上级目标
    if (createPbcDto.goal_type === 'business' && createPbcDto.supervisor_goal_id) {
      createData.supervisor_goal_id = createPbcDto.supervisor_goal_id;
    }

    // 可选字段
    if (createPbcDto.measures) createData.measures = createPbcDto.measures;
    if (createPbcDto.unacceptable) createData.unacceptable = createPbcDto.unacceptable;
    if (createPbcDto.acceptable) createData.acceptable = createPbcDto.acceptable;
    if (createPbcDto.excellent) createData.excellent = createPbcDto.excellent;
    
    // 处理完成时间，转换为 Date 对象
    if (createPbcDto.completion_time) {
      console.log('   原始 completion_time:', createPbcDto.completion_time);
      createData.completion_time = new Date(createPbcDto.completion_time);
      console.log('   转换后 completion_time:', createData.completion_time);
    }

    console.log('准备创建的数据:', JSON.stringify(createData, null, 2));

    try {
      const result = await this.prisma.pbcGoal.create({
        data: createData,
      });
      console.log('✅ 目标创建成功, goal_id:', result.goal_id);
      console.log('=== 创建PBC目标结束 ===\n');
      return result;
    } catch (error) {
      console.log('❌ 数据库创建失败:', error.message);
      console.log('错误详情:', error);
      console.log('=== 创建PBC目标结束（失败）===\n');
      throw error;
    }
  }

  async findAll(query: {
    userId?: number;
    year?: number;
    quarter?: number;
    status?: string;
    goalType?: string;
  }) {
    const where: any = {
      parent_goal_id: null,
    };

    if (query.userId) {
      where.user_id = query.userId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.goalType) {
      where.goal_type = query.goalType;
    }

    if (query.year || query.quarter) {
      where.period = {};
      if (query.year) where.period.year = query.year;
      if (query.quarter) where.period.quarter = query.quarter;
    }

    const goals = await this.prisma.pbcGoal.findMany({
      where,
      include: {
        user: true,
        period: true,
        parentGoal: true,
        subGoals: true,
        supervisorGoal: true,
        approvals: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            reviewer: {
              select: {
                user_id: true,
                real_name: true,
              },
            },
          },
        },
      },
    });

    // 为每个目标添加最新的驳回原因
    return goals.map(goal => ({
      ...goal,
      latestApproval: goal.approvals[0] || null,
    }));
  }

  async findOne(id: number) {
    const goal = await this.prisma.pbcGoal.findUnique({
      where: { goal_id: id },
      include: {
        user: true,
        period: true,
        parentGoal: true,
        subGoals: true,
        supervisorGoal: true,
      },
    });

    if (!goal) {
      throw new NotFoundException('目标不存在');
    }

    return goal;
  }

  async update(id: number, userId: number, updatePbcDto: UpdatePbcDto) {
    const goal = await this.findOne(id);

    if (goal.user_id !== userId) {
      throw new ForbiddenException('无权修改他人目标');
    }

    // 只允许draft、rejected、approved状态修改
    // submitted（审批中）和archived（已归档）状态不允许修改
    if (goal.status !== 'draft' && goal.status !== 'rejected' && goal.status !== 'approved') {
      if (goal.status === 'submitted') {
        throw new BadRequestException('目标审批中，不允许修改。如需修改，请联系主管撤回审批。');
      } else if (goal.status === 'archived') {
        throw new BadRequestException('目标已归档，不允许修改');
      } else {
        throw new BadRequestException('当前状态不允许修改');
      }
    }

    // 如果是已通过的目标，检查是否已提交自评
    if (goal.status === 'approved' && goal.period_id) {
      const evaluation = await this.prisma.pbcEvaluation.findUnique({
        where: {
          user_id_period_id: {
            user_id: userId,
            period_id: goal.period_id,
          },
        },
      });

      if (evaluation?.self_submitted_at) {
        throw new BadRequestException('已提交自评，不允许变更目标。如需变更，请联系主管。');
      }
    }

    // 处理更新数据
    const updateData: any = { ...updatePbcDto };
    
    // 如果有 completion_time，转换为 Date 对象
    if (updateData.completion_time) {
      updateData.completion_time = new Date(updateData.completion_time);
    }

    // 如果修改的是已通过的目标，重置状态为草稿，并清空自评和主管评价
    if (goal.status === 'approved') {
      updateData.status = 'draft';
      updateData.self_score = null;
      updateData.self_comment = null;
      updateData.supervisor_score = null;
      updateData.supervisor_comment = null;
    }

    return this.prisma.pbcGoal.update({
      where: { goal_id: id },
      data: updateData,
    });
  }

  async delete(id: number, userId: number) {
    const goal = await this.findOne(id);

    if (goal.user_id !== userId) {
      throw new ForbiddenException('无权删除他人目标');
    }

    if (goal.status !== 'draft') {
      throw new BadRequestException('只能删除草稿状态的目标');
    }

    await this.prisma.pbcGoal.delete({
      where: { goal_id: id },
    });
    
    return { message: '删除成功' };
  }

  // 批量提交当前周期的所有草稿状态目标
  async submitAll(userId: number, periodId?: number) {
    console.log('\n=== 批量提交目标 ===');
    console.log('用户ID:', userId, '周期ID:', periodId);

    // 如果没有指定周期，使用当前活动周期
    let targetPeriodId = periodId;
    if (!targetPeriodId) {
      const activePeriod = await this.findActivePeriod();
      if (!activePeriod) {
        throw new BadRequestException('没有活动周期');
      }
      targetPeriodId = activePeriod.period_id;
    }

    console.log('目标周期ID:', targetPeriodId);

    // 查找当前周期内所有草稿或被驳回状态的主目标（不包括子目标）
    const goalsToSubmit = await this.prisma.pbcGoal.findMany({
      where: {
        user_id: userId,
        period_id: targetPeriodId,
        parent_goal_id: null,
        status: {
          in: ['draft', 'rejected'],
        },
      },
      include: {
        subGoals: true,
      },
    });

    console.log('需要提交的目标数量:', goalsToSubmit.length);
    console.log('需要提交的目标列表:', goalsToSubmit.map(g => ({ 
      goal_id: g.goal_id, 
      goal_name: g.goal_name, 
      goal_type: g.goal_type,
      goal_weight: g.goal_weight,
      status: g.status 
    })));

    if (goalsToSubmit.length === 0) {
      console.log('❌ 没有可提交的目标');
      throw new BadRequestException('没有可提交的目标');
    }

    // 验证权重总和：需要查询该周期内所有主目标（包括已通过的）
    const allGoals = await this.prisma.pbcGoal.findMany({
      where: {
        user_id: userId,
        period_id: targetPeriodId,
        parent_goal_id: null,
        status: {
          in: ['draft', 'rejected', 'approved'], // 包括已通过的目标
        },
      },
    });

    console.log('该周期所有目标数量:', allGoals.length);
    console.log('所有目标列表:', allGoals.map(g => ({ 
      goal_id: g.goal_id, 
      goal_name: g.goal_name, 
      goal_weight: g.goal_weight,
      status: g.status 
    })));

    const totalWeight = allGoals.reduce((sum, goal) => {
      return sum + Number(goal.goal_weight);
    }, 0);

    console.log('总权重:', totalWeight, '%');

    if (Math.abs(totalWeight - 100) > 0.01) {
      console.log(`❌ 权重验证失败: ${totalWeight}% (需要100%)`);
      throw new BadRequestException(`目标权重总和必须为100%，当前为${totalWeight}%`);
    }

    console.log('✓ 权重验证通过');

    // 批量更新主目标和子目标状态
    const goalIds = goalsToSubmit.map(g => g.goal_id);
    
    // 更新主目标
    await this.prisma.pbcGoal.updateMany({
      where: {
        goal_id: { in: goalIds },
      },
      data: { status: 'submitted' },
    });

    // 更新子目标
    for (const goal of goalsToSubmit) {
      if (goal.subGoals && goal.subGoals.length > 0) {
        const subGoalIds = goal.subGoals.map(sg => sg.goal_id);
        await this.prisma.pbcGoal.updateMany({
          where: {
            goal_id: { in: subGoalIds },
          },
          data: { status: 'submitted' },
        });
      }
    }

    // 为每个主目标记录审批流程
    for (const goal of goalsToSubmit) {
      await this.prisma.pbcApproval.create({
        data: {
          goal_id: goal.goal_id,
          reviewer_id: userId,
          action: 'submit',
        },
      });
    }

    // 发送钉钉通知给主管
    try {
      const user = await this.prisma.user.findUnique({
        where: { user_id: userId },
        include: {
          supervisor: true,
        },
      });

      if (user && user.supervisor && user.supervisor.dingtalk_userid) {
        const period = await this.prisma.pbcPeriod.findUnique({
          where: { period_id: targetPeriodId },
        });
        
        const periodName = period 
          ? `${period.year}年第${period.quarter}季度` 
          : '当前周期';

        await this.dingtalkService.sendSubmitNotification(
          user.supervisor.organization || '安恒',
          user.supervisor.dingtalk_userid,
          user.real_name,
          periodName,
          goalsToSubmit.length,
        );
      }
    } catch (error) {
      console.error('发送钉钉通知失败:', error);
      // 通知失败不影响主流程
    }

    return {
      message: `成功提交 ${goalsToSubmit.length} 个目标`,
      count: goalsToSubmit.length,
      goals: goalsToSubmit.map(g => ({
        goal_id: g.goal_id,
        goal_name: g.goal_name,
      })),
    };
  }

  async getSupervisorGoals(userId: number, periodId?: number) {
    console.log('\n=== 获取上级目标 ===');
    console.log('当前用户ID:', userId, '周期ID:', periodId);

    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      include: { supervisor: true },
    });

    console.log('用户信息:', {
      user_id: user?.user_id,
      real_name: user?.real_name,
      supervisor_id: user?.supervisor_id,
      supervisor_name: user?.supervisor?.real_name,
    });

    if (!user || !user.supervisor_id) {
      console.log('⚠️ 用户没有上级主管，返回空');
      return [];
    }

    const where: any = {
      user_id: user.supervisor_id,
      goal_type: 'business', // 查询上级的业务目标（原"个人业务目标"）
      parent_goal_id: null,
      status: 'approved', // 只返回已审核通过的目标
    };

    if (periodId) {
      where.period_id = periodId;
    }

    console.log('查询条件:', where);

    const goals = await this.prisma.pbcGoal.findMany({ 
      where,
      include: {
        period: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    console.log('✅ 找到的上级团队目标数量:', goals.length);
    if (goals.length > 0) {
      console.log('目标列表:', goals.map(g => ({
        goal_id: g.goal_id,
        goal_name: g.goal_name,
        goal_type: g.goal_type,
        status: g.status,
        period: g.period ? `${g.period.year}Q${g.period.quarter}` : '无周期',
      })));
    }
    console.log('=== 获取上级目标结束 ===\n');

    return goals;
  }

  // 查看团队目标（按人员和季度展示所有非草稿状态的目标）
  async getTeamGoals(currentUserId: number, periodId?: number) {
    console.log('\n=== 查询团队目标 ===');
    console.log('当前用户ID:', currentUserId, '周期ID:', periodId);

    const currentUser = await this.prisma.user.findUnique({
      where: { user_id: currentUserId },
      include: { department: true },
    });

    if (!currentUser) {
      throw new NotFoundException('当前用户不存在');
    }

    console.log('用户:', currentUser.real_name, '角色:', currentUser.role, '部门ID:', currentUser.department_id);

    const where: any = {
      parent_goal_id: null, // 只查主目标
      status: { not: 'draft' }, // 排除草稿状态
    };

    if (periodId) {
      where.period_id = periodId;
    }

    // 根据角色设置权限过滤
    if (currentUser.role === 'employee') {
      // 普通员工只能看到自己的目标
      console.log('>> 普通员工：查看自己的目标');
      where.user_id = currentUserId;
    } else if (currentUser.role === 'manager') {
      // 经理只能看到本部门员工的目标（不包含子部门）
      console.log('>> 经理：查看本部门员工的目标');
      
      if (!currentUser.department_id) {
        console.log('⚠️ 用户没有所属部门，返回空');
        return [];
      }

      const deptUsers = await this.prisma.user.findMany({
        where: { department_id: currentUser.department_id },
        select: { user_id: true, real_name: true },
      });
      console.log('   本部门用户:', deptUsers.map(u => u.real_name).join(', '));
      
      const userIds = deptUsers.map(u => u.user_id);
      if (userIds.length === 0) {
        console.log('⚠️ 部门没有用户，返回空');
        return [];
      }
      
      where.user_id = { in: userIds };
    } else if (currentUser.role === 'assistant' || currentUser.role === 'gm') {
      // 助理和总经理可以看到所属部门及所有子部门员工的目标
      console.log('>> 助理/总经理：查看部门及子部门员工的目标');
      
      if (!currentUser.department_id) {
        console.log('⚠️ 用户没有所属部门，返回空');
        return [];
      }

      const { DepartmentsService } = await import('../departments/departments.service');
      const deptService = new DepartmentsService(this.prisma);
      const departmentIds = await deptService.getAllSubDepartmentIds(currentUser.department_id);
      console.log('   部门ID列表（含子部门）:', departmentIds);
      
      const deptUsers = await this.prisma.user.findMany({
        where: { department_id: { in: departmentIds } },
        select: { user_id: true, real_name: true },
      });
      console.log('   部门用户:', deptUsers.map(u => u.real_name).join(', '));
      
      const userIds = deptUsers.map(u => u.user_id);
      if (userIds.length === 0) {
        console.log('⚠️ 部门没有用户，返回空');
        return [];
      }
      
      where.user_id = { in: userIds };
    }

    const results = await this.prisma.pbcGoal.findMany({
      where,
      include: {
        user: {
          include: {
            department: true,
          },
        },
        period: true,
        subGoals: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    console.log('✅ 查询结果数量:', results.length);
    console.log('=== 查询团队目标结束 ===\n');

    return results;
  }

  // 子目标管理
  async createSubGoal(parentId: number, userId: number, createPbcDto: CreatePbcDto) {
    const parentGoal = await this.findOne(parentId);

    if (parentGoal.user_id !== userId) {
      throw new ForbiddenException('无权为他人目标添加子目标');
    }

    return this.prisma.pbcGoal.create({
      data: {
        ...createPbcDto,
        user_id: userId,
        parent_goal_id: parentId,
        period_id: parentGoal.period_id,
        status: 'draft',
      },
    });
  }

  // 自评
  async selfEvaluate(id: number, userId: number, score: number, comment: string) {
    const goal = await this.findOne(id);

    if (goal.user_id !== userId) {
      throw new ForbiddenException('无权评价他人目标');
    }

    if (goal.status !== 'approved') {
      throw new BadRequestException('只能对已通过审核的目标进行自评');
    }

    return this.prisma.pbcGoal.update({
      where: { goal_id: id },
      data: {
        self_score: score,
        self_comment: comment,
      },
    });
  }

  // 提交整体自评
  async submitSelfEvaluation(userId: number, periodId: number, overallComment: string) {
    // 检查该周期的所有目标是否都已自评
    const goals = await this.prisma.pbcGoal.findMany({
      where: {
        user_id: userId,
        period_id: periodId,
        parent_goal_id: null,
        status: 'approved',
      },
    });

    const unevaluatedGoals = goals.filter(g => !g.self_score);
    if (unevaluatedGoals.length > 0) {
      throw new BadRequestException(
        `还有 ${unevaluatedGoals.length} 个目标未完成自评`,
      );
    }

    // 创建或更新整体评价记录
    return this.prisma.pbcEvaluation.upsert({
      where: {
        user_id_period_id: {
          user_id: userId,
          period_id: periodId,
        },
      },
      create: {
        user_id: userId,
        period_id: periodId,
        self_overall_comment: overallComment,
        self_submitted_at: new Date(),
      },
      update: {
        self_overall_comment: overallComment,
        self_submitted_at: new Date(),
      },
    });
  }

  // 获取评价信息
  async getEvaluation(userId: number, periodId: number) {
    const evaluation = await this.prisma.pbcEvaluation.findUnique({
      where: {
        user_id_period_id: {
          user_id: userId,
          period_id: periodId,
        },
      },
      include: {
        user: {
          select: {
            user_id: true,
            real_name: true,
          },
        },
        period: true,
      },
    });

    // 获取该周期的所有目标及其评价
    const goals = await this.prisma.pbcGoal.findMany({
      where: {
        user_id: userId,
        period_id: periodId,
        parent_goal_id: null,
      },
      include: {
        period: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    return {
      evaluation,
      goals,
    };
  }

  // 主管评价单个目标
  async supervisorEvaluate(id: number, supervisorId: number, score: number, comment: string) {
    const goal = await this.findOne(id);

    // 检查评价者是否是目标用户的主管
    const goalUser = await this.prisma.user.findUnique({
      where: { user_id: goal.user_id },
    });

    if (!goalUser) {
      throw new BadRequestException('目标用户不存在');
    }

    if (goalUser.supervisor_id !== supervisorId) {
      throw new ForbiddenException('只能评价自己下属的目标');
    }

    if (goal.status !== 'approved') {
      throw new BadRequestException('只能评价已通过审核的目标');
    }

    // 检查是否已提交自评
    if (!goal.self_score) {
      throw new BadRequestException('员工尚未完成自评');
    }

    return this.prisma.pbcGoal.update({
      where: { goal_id: id },
      data: {
        supervisor_score: score,
        supervisor_comment: comment,
      },
    });
  }

  // 提交整体主管评价
  async submitSupervisorEvaluation(
    userId: number,
    periodId: number,
    supervisorId: number,
    overallComment: string,
  ) {
    // 检查该周期的所有目标是否都已主管评价
    const goals = await this.prisma.pbcGoal.findMany({
      where: {
        user_id: userId,
        period_id: periodId,
        parent_goal_id: null,
        status: 'approved',
      },
    });

    const unevaluatedGoals = goals.filter(g => !g.supervisor_score);
    if (unevaluatedGoals.length > 0) {
      throw new BadRequestException(
        `还有 ${unevaluatedGoals.length} 个目标未完成评价`,
      );
    }

    // 检查是否已提交自评
    const evaluation = await this.prisma.pbcEvaluation.findUnique({
      where: {
        user_id_period_id: {
          user_id: userId,
          period_id: periodId,
        },
      },
    });

    if (!evaluation || !evaluation.self_submitted_at) {
      throw new BadRequestException('员工尚未提交整体自评');
    }

    // 更新整体评价记录
    return this.prisma.pbcEvaluation.update({
      where: {
        user_id_period_id: {
          user_id: userId,
          period_id: periodId,
        },
      },
      data: {
        supervisor_overall_comment: overallComment,
        supervisor_submitted_at: new Date(),
      },
    });
  }

  // 获取用户的PBC统计
  async getUserPbcSummary(userId: number, periodId?: number) {
    const where: any = {
      user_id: userId,
      parent_goal_id: null,
    };

    if (periodId) {
      where.period_id = periodId;
    }

    const goals = await this.prisma.pbcGoal.findMany({ where });

    // 因为是批量审批，所以整个周期的目标状态应该是统一的
    // 统计当前状态和目标总数
    const statusCount = {
      draft: goals.filter(g => g.status === 'draft').length,
      submitted: goals.filter(g => g.status === 'submitted').length,
      approved: goals.filter(g => g.status === 'approved').length,
      rejected: goals.filter(g => g.status === 'rejected').length,
      archived: goals.filter(g => g.status === 'archived').length,
    };

    // 确定整体状态
    // 优先级：draft/rejected（允许提交） > submitted（审核中） > approved（已通过） > archived（已归档）
    let overallStatus = 'draft';
    
    // 如果有草稿或被驳回的目标，整体状态应该是需要提交的状态
    if (statusCount.draft > 0 || statusCount.rejected > 0) {
      overallStatus = statusCount.rejected > 0 ? 'rejected' : 'draft';
    }
    // 如果有提交中的目标（且没有draft/rejected），整体状态是submitted
    else if (statusCount.submitted > 0) {
      overallStatus = 'submitted';
    }
    // 如果所有目标都已通过，整体状态是approved
    else if (statusCount.approved > 0) {
      overallStatus = 'approved';
    }
    // 如果所有目标都已归档，整体状态是archived
    else if (statusCount.archived > 0) {
      overallStatus = 'archived';
    }

    return {
      total: goals.length,
      status: overallStatus,
      statusDetail: statusCount,
      message: this.getStatusMessage(overallStatus),
    };
  }

  private getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      draft: '草稿中，尚未提交',
      submitted: '已提交，等待主管审核',
      approved: '已通过审核',
      rejected: '已驳回，需要修改后重新提交',
      archived: '已归档',
    };
    return messages[status] || '未知状态';
  }
}
