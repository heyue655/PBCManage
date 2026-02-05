import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { DingtalkService } from '../dingtalk/dingtalk.service';
import { CreateUserDto, UpdateUserDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private dingtalkService: DingtalkService,
  ) {}

  async findAll(currentUserId: number, query: { departmentId?: number; role?: string }) {
    // 先获取当前用户信息
    const currentUser = await this.prisma.user.findUnique({
      where: { user_id: currentUserId },
      include: { department: true },
    });

    if (!currentUser) {
      throw new NotFoundException('当前用户不存在');
    }

    const where: any = {};
    
    // 根据角色设置权限过滤
    if (currentUser.role === 'employee') {
      // 普通员工只能看到自己
      where.user_id = currentUserId;
    } else if (currentUser.role === 'manager') {
      // 经理只能看到本部门的人员
      if (currentUser.department_id) {
        where.department_id = currentUser.department_id;
      }
    } else if (currentUser.role === 'assistant' || currentUser.role === 'gm') {
      // 助理和总经理可以看到所属部门及所有子部门的人员
      if (currentUser.department_id) {
        const { DepartmentsService } = await import('../departments/departments.service');
        const deptService = new DepartmentsService(this.prisma);
        const departmentIds = await deptService.getAllSubDepartmentIds(currentUser.department_id);
        where.department_id = { in: departmentIds };
      }
    }
    
    // 额外的筛选条件
    if (query.departmentId) {
      where.department_id = query.departmentId;
    }
    
    if (query.role) {
      where.role = query.role;
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        department: true,
        supervisor: true,
      },
    });

    return users.map(user => ({
      ...user,
      password: undefined,
      // 标记是否可编辑（普通员工不可编辑）
      canEdit: currentUser.role !== 'employee',
    }));
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: id },
      include: {
        department: true,
        supervisor: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return {
      ...user,
      password: undefined,
    };
  }

  async findSubordinates(userId: number) {
    const subordinates = await this.prisma.user.findMany({
      where: { supervisor_id: userId },
      include: { department: true },
    });

    return subordinates.map(user => ({
      ...user,
      password: undefined,
    }));
  }

  async create(currentUserId: number, createUserDto: CreateUserDto) {
    // 验证权限：普通员工不能创建用户
    const currentUser = await this.prisma.user.findUnique({
      where: { user_id: currentUserId },
    });

    if (!currentUser) {
      throw new NotFoundException('当前用户不存在');
    }

    if (currentUser.role === 'employee') {
      throw new BadRequestException('普通员工无权创建用户');
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: createUserDto.username },
    });

    if (existing) {
      throw new BadRequestException('用户名已存在');
    }

    const hashedPassword = await bcrypt.hash('123456', 10);

    // 根据姓名和组织自动查询钉钉userid
    let dingtalkUserId: string | null = createUserDto.dingtalk_userid || null;
    console.log('===== 创建用户 - 钉钉userid查询 =====');
    console.log('传入的dingtalk_userid:', dingtalkUserId);
    console.log('用户姓名:', createUserDto.real_name);
    console.log('所属组织:', createUserDto.organization);
    
    if (!dingtalkUserId && createUserDto.organization && createUserDto.real_name) {
      console.log('开始自动查询钉钉userid...');
      try {
        const searchResult = await this.dingtalkService.searchUserIdByName(
          createUserDto.organization,
          createUserDto.real_name
        );
        console.log('查询结果:', searchResult);
        if (searchResult) {
          dingtalkUserId = searchResult;
          console.log('✅ 自动填充钉钉userid:', dingtalkUserId);
        } else {
          dingtalkUserId = null;
          console.log('⚠️ 未找到匹配的钉钉用户，userid为空');
        }
      } catch (error) {
        // 查询失败，userid设为null
        dingtalkUserId = null;
        console.error('❌ 查询钉钉userid失败，userid为空:', error.message);
      }
    } else {
      console.log('跳过自动查询（已有userid或缺少必要参数）');
    }
    console.log('最终dingtalk_userid:', dingtalkUserId);
    console.log('=====================================');

    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        dingtalk_userid: dingtalkUserId,
        password: hashedPassword,
      },
    });

    return {
      ...user,
      password: undefined,
    };
  }

  async update(currentUserId: number, id: number, updateUserDto: UpdateUserDto) {
    // 验证权限：普通员工不能更新用户
    const currentUser = await this.prisma.user.findUnique({
      where: { user_id: currentUserId },
    });

    if (!currentUser) {
      throw new NotFoundException('当前用户不存在');
    }

    if (currentUser.role === 'employee') {
      throw new BadRequestException('普通员工无权编辑用户信息');
    }

    const user = await this.prisma.user.findUnique({
      where: { user_id: id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 如果姓名或组织发生变化，重新查询钉钉userid
    let shouldUpdateDingtalkUserId = false; // 标记是否需要更新userid字段
    let dingtalkUserId: string | null = updateUserDto.dingtalk_userid || null;
    const nameChanged = updateUserDto.real_name && updateUserDto.real_name !== user.real_name;
    const orgChanged = updateUserDto.organization && updateUserDto.organization !== user.organization;
    
    console.log('===== 更新用户 - 钉钉userid查询 =====');
    console.log('用户ID:', id);
    console.log('姓名是否变化:', nameChanged, `(${user.real_name} -> ${updateUserDto.real_name})`);
    console.log('组织是否变化:', orgChanged, `(${user.organization} -> ${updateUserDto.organization})`);
    console.log('传入的dingtalk_userid:', updateUserDto.dingtalk_userid);
    console.log('当前数据库中的dingtalk_userid:', user.dingtalk_userid);
    
    if ((nameChanged || orgChanged) && !updateUserDto.dingtalk_userid) {
      const finalOrganization = updateUserDto.organization || user.organization;
      const finalRealName = updateUserDto.real_name || user.real_name;
      
      console.log('姓名或组织发生变化，需要重新查询钉钉userid');
      console.log('查询参数 - 组织:', finalOrganization, '姓名:', finalRealName);
      
      shouldUpdateDingtalkUserId = true; // 标记需要更新
      
      try {
        const searchResult = await this.dingtalkService.searchUserIdByName(
          finalOrganization,
          finalRealName
        );
        console.log('查询结果:', searchResult);
        if (searchResult) {
          dingtalkUserId = searchResult;
          console.log('✅ 自动填充钉钉userid:', dingtalkUserId);
        } else {
          dingtalkUserId = null;
          console.log('⚠️ 未找到匹配的钉钉用户，将清空userid');
        }
      } catch (error) {
        // 查询失败，清空userid
        dingtalkUserId = null;
        console.error('❌ 查询钉钉userid失败，将清空userid:', error.message);
      }
    } else {
      console.log('跳过自动查询（姓名组织未变化或已提供userid）');
    }
    console.log('最终dingtalk_userid:', dingtalkUserId);
    console.log('是否更新userid字段:', shouldUpdateDingtalkUserId);
    console.log('=====================================');

    const updateData: any = { ...updateUserDto };
    
    // 如果需要更新userid字段，显式设置（即使是null也要更新）
    if (shouldUpdateDingtalkUserId) {
      updateData.dingtalk_userid = dingtalkUserId;
    }

    const updated = await this.prisma.user.update({
      where: { user_id: id },
      data: updateData,
    });

    return {
      ...updated,
      password: undefined,
    };
  }

  async delete(currentUserId: number, id: number) {
    // 验证权限：普通员工不能删除用户
    const currentUser = await this.prisma.user.findUnique({
      where: { user_id: currentUserId },
    });

    if (!currentUser) {
      throw new NotFoundException('当前用户不存在');
    }

    if (currentUser.role === 'employee') {
      throw new BadRequestException('普通员工无权删除用户');
    }

    const user = await this.prisma.user.findUnique({
      where: { user_id: id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    await this.prisma.user.delete({
      where: { user_id: id },
    });
    
    return { message: '删除成功' };
  }

  async importFromExcel(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const row of data as any[]) {
      try {
        if (!row['账号'] || !row['姓名']) {
          results.failed++;
          results.errors.push(`行数据缺少必填字段: ${JSON.stringify(row)}`);
          continue;
        }

        let department = null;
        if (row['部门']) {
          department = await this.prisma.department.findFirst({
            where: { department_name: row['部门'] },
          });
          if (!department) {
            department = await this.prisma.department.create({
              data: { department_name: row['部门'] },
            });
          }
        }

        let supervisor = null;
        if (row['直属主管']) {
          supervisor = await this.prisma.user.findFirst({
            where: { real_name: row['直属主管'] },
          });
        }

        let role = 'employee';
        if (row['岗位']) {
          const jobTitle = row['岗位'].toLowerCase();
          if (jobTitle.includes('总经理')) {
            role = 'gm';
          } else if (jobTitle.includes('经理')) {
            role = 'manager';
          } else if (jobTitle.includes('助理')) {
            role = 'assistant';
          }
        }

        const existingUser = await this.prisma.user.findUnique({
          where: { username: row['账号'] },
        });

        if (existingUser) {
          await this.prisma.user.update({
            where: { user_id: existingUser.user_id },
            data: {
              real_name: row['姓名'],
              job_title: row['岗位'] || existingUser.job_title,
              department_id: department?.department_id || existingUser.department_id,
              supervisor_id: supervisor?.user_id || existingUser.supervisor_id,
              role: role as any,
            },
          });
        } else {
          const hashedPassword = await bcrypt.hash('123456', 10);
          await this.prisma.user.create({
            data: {
              username: row['账号'],
              password: hashedPassword,
              real_name: row['姓名'],
              job_title: row['岗位'] || '员工',
              department_id: department?.department_id,
              supervisor_id: supervisor?.user_id,
              role: role as any,
            },
          });
        }

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`处理行数据时出错: ${error}`);
      }
    }

    return results;
  }

  async getHierarchy(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      include: { department: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const subordinates = await this.getSubordinatesRecursive(userId);

    return {
      ...user,
      password: undefined,
      subordinates,
    };
  }

  private async getSubordinatesRecursive(userId: number): Promise<any[]> {
    const directSubordinates = await this.prisma.user.findMany({
      where: { supervisor_id: userId },
      include: { department: true },
    });

    const result = [];
    for (const sub of directSubordinates) {
      const subSubordinates = await this.getSubordinatesRecursive(sub.user_id);
      result.push({
        ...sub,
        password: undefined,
        subordinates: subSubordinates,
      });
    }

    return result;
  }
}
