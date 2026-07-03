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

  async findAll(currentUserId: number, query: { departmentId?: number; role?: string; realName?: string; jobTitle?: string; organization?: string }) {
    const currentUser = await this.prisma.user.findUnique({
      where: { user_id: currentUserId },
      include: { department: true },
    });

    if (!currentUser) {
      throw new NotFoundException('当前用户不存在');
    }

    const where: any = {};
    
    if (currentUser.role === 'employee') {
      where.user_id = currentUserId;
    } else if (currentUser.role === 'manager') {
      if (currentUser.department_id) {
        where.department_id = currentUser.department_id;
      }
    } else if (currentUser.role === 'assistant' || currentUser.role === 'gm') {
      if (currentUser.department_id) {
        const { DepartmentsService } = await import('../departments/departments.service');
        const deptService = new DepartmentsService(this.prisma);
        const departmentIds = await deptService.getAllSubDepartmentIds(currentUser.department_id);
        where.department_id = { in: departmentIds };
      }
    }
    
    if (query.departmentId) {
      where.department_id = query.departmentId;
    }
    
    if (query.role) {
      where.role = query.role;
    }

    if (query.realName) {
      where.real_name = { contains: query.realName };
    }

    if (query.jobTitle) {
      where.job_title = { contains: query.jobTitle };
    }

    if (query.organization) {
      where.organization = query.organization;
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        department: true,
        functionalSupervisor: true,
        businessSupervisor: true,
      },
    });

    return users.map(user => ({
      ...user,
      password: undefined,
      canEdit: currentUser.role !== 'employee',
    }));
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: id },
      include: {
        department: true,
        functionalSupervisor: true,
        businessSupervisor: true,
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
      where: {
        OR: [
          { functional_supervisor_id: userId },
          { business_supervisor_id: userId },
        ],
      },
      include: { department: true },
    });

    return subordinates.map(user => ({
      ...user,
      password: undefined,
    }));
  }

  async create(currentUserId: number, createUserDto: CreateUserDto) {
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

    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: updateUserDto.username },
      });
      if (existing) {
        throw new BadRequestException('用户名已存在');
      }
    }

    let shouldUpdateDingtalkUserId = false;
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
      
      shouldUpdateDingtalkUserId = true;
      
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

  async resetPassword(currentUserId: number, id: number) {
    const currentUser = await this.prisma.user.findUnique({
      where: { user_id: currentUserId },
    });

    if (!currentUser) {
      throw new NotFoundException('当前用户不存在');
    }

    if (currentUser.role === 'employee') {
      throw new BadRequestException('普通员工无权重置密码');
    }

    const user = await this.prisma.user.findUnique({
      where: { user_id: id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const hashedPassword = await bcrypt.hash('123456', 10);
    await this.prisma.user.update({
      where: { user_id: id },
      data: { password: hashedPassword },
    });

    return { message: '密码已重置为123456' };
  }

  generateImportTemplate(): Buffer {
    const templateData = [
      {
        '账号': 'zhangsan',
        '姓名': '张三',
        '职位': '高级工程师',
        '部门': '技术部',
        '角色': '员工',
        '所属组织': '安恒',
        '职能主管': '李四',
        '业务主管': '王五',
      },
    ];

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(templateData);

    sheet['!cols'] = [
      { wch: 15 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(workbook, sheet, '人员导入模板');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
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

        let functionalSupervisor = null;
        if (row['职能主管']) {
          functionalSupervisor = await this.prisma.user.findFirst({
            where: { real_name: row['职能主管'] },
          });
        }

        let businessSupervisor = null;
        if (row['业务主管']) {
          businessSupervisor = await this.prisma.user.findFirst({
            where: { real_name: row['业务主管'] },
          });
        }

        let role = 'employee';
        if (row['角色']) {
          const roleText = row['角色'].trim();
          const roleMapping: Record<string, string> = {
            '员工': 'employee',
            '助理': 'assistant',
            '经理': 'manager',
            '总经理': 'gm',
          };
          if (roleMapping[roleText]) {
            role = roleMapping[roleText];
          }
        } else if (row['职位'] || row['岗位']) {
          const jobTitle = (row['职位'] || row['岗位']).toLowerCase();
          if (jobTitle.includes('总经理')) {
            role = 'gm';
          } else if (jobTitle.includes('经理')) {
            role = 'manager';
          } else if (jobTitle.includes('助理')) {
            role = 'assistant';
          }
        }

        const organization = row['所属组织'] || '安恒';
        const jobTitle = row['职位'] || row['岗位'] || '员工';

        const existingUser = await this.prisma.user.findUnique({
          where: { username: row['账号'] },
        });

        if (existingUser) {
          let dingtalkUserId: string | null = existingUser.dingtalk_userid;
          const nameChanged = row['姓名'] !== existingUser.real_name;
          const orgChanged = organization !== existingUser.organization;
          if (nameChanged || orgChanged) {
            try {
              const searchResult = await this.dingtalkService.searchUserIdByName(organization, row['姓名']);
              dingtalkUserId = searchResult || null;
            } catch {
            }
          }

          await this.prisma.user.update({
            where: { user_id: existingUser.user_id },
            data: {
              real_name: row['姓名'],
              job_title: jobTitle,
              department_id: department?.department_id || existingUser.department_id,
              functional_supervisor_id: functionalSupervisor?.user_id || existingUser.functional_supervisor_id,
              business_supervisor_id: businessSupervisor?.user_id || existingUser.business_supervisor_id,
              role: role as any,
              organization: organization,
              dingtalk_userid: dingtalkUserId,
            },
          });
        } else {
          let dingtalkUserId: string | null = null;
          try {
            const searchResult = await this.dingtalkService.searchUserIdByName(organization, row['姓名']);
            dingtalkUserId = searchResult || null;
          } catch {
          }

          const hashedPassword = await bcrypt.hash('123456', 10);
          await this.prisma.user.create({
            data: {
              username: row['账号'],
              password: hashedPassword,
              real_name: row['姓名'],
              job_title: jobTitle,
              department_id: department?.department_id,
              functional_supervisor_id: functionalSupervisor?.user_id,
              business_supervisor_id: businessSupervisor?.user_id,
              role: role as any,
              organization: organization,
              dingtalk_userid: dingtalkUserId,
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
      where: {
        OR: [
          { functional_supervisor_id: userId },
          { business_supervisor_id: userId },
        ],
      },
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
