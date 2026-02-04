import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
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

    const updated = await this.prisma.user.update({
      where: { user_id: id },
      data: updateUserDto,
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
