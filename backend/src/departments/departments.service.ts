import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId?: number) {
    // 如果提供了userId，根据用户角色返回相应的部门
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { user_id: userId },
        include: { department: true },
      });

      if (!user) {
        return [];
      }

      // 总经理可以查看所有部门
      if (user.role === 'gm') {
        return this.prisma.department.findMany({
          include: { parent: true },
          orderBy: { department_id: 'asc' },
        });
      }

      // 其他角色只能查看自己所在的部门及子部门
      if (user.department_id) {
        const departmentIds = await this.getAllSubDepartmentIds(user.department_id);
        return this.prisma.department.findMany({
          where: { department_id: { in: departmentIds } },
          include: { parent: true },
          orderBy: { department_id: 'asc' },
        });
      }

      return [];
    }

    // 如果没有提供userId，返回所有部门（向后兼容）
    return this.prisma.department.findMany({
      include: { parent: true },
      orderBy: { department_id: 'asc' },
    });
  }

  async findOne(id: number) {
    const department = await this.prisma.department.findUnique({
      where: { department_id: id },
      include: {
        parent: true,
        children: true,
      },
    });

    if (!department) {
      throw new NotFoundException('部门不存在');
    }

    return department;
  }

  async getTree() {
    const allDepartments = await this.prisma.department.findMany();
    return this.buildTree(allDepartments);
  }

  private buildTree(departments: any[], parentId: number | null = null): any[] {
    return departments
      .filter(dept => dept.parent_id === parentId)
      .map(dept => ({
        ...dept,
        children: this.buildTree(departments, dept.department_id),
      }));
  }

  // 递归获取某个部门及其所有子部门的ID列表
  async getAllSubDepartmentIds(departmentId: number): Promise<number[]> {
    const result: number[] = [departmentId];
    
    const children = await this.prisma.department.findMany({
      where: { parent_id: departmentId },
    });

    for (const child of children) {
      const subIds = await this.getAllSubDepartmentIds(child.department_id);
      result.push(...subIds);
    }

    return result;
  }

  async create(createDepartmentDto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: createDepartmentDto,
    });
  }

  async update(id: number, updateDepartmentDto: UpdateDepartmentDto) {
    await this.findOne(id);
    
    return this.prisma.department.update({
      where: { department_id: id },
      data: updateDepartmentDto,
    });
  }

  async delete(id: number) {
    await this.findOne(id);
    
    await this.prisma.department.delete({
      where: { department_id: id },
    });
    
    return { message: '删除成功' };
  }
}
