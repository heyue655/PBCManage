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
      // 支持多部门助理：合并 department_id 和 managed_department_ids
      const rootDeptIds = this.getManagedDepartmentIds(user);
      if (rootDeptIds.length > 0) {
        const departmentIds = await this.getAllSubDepartmentIds(rootDeptIds);
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

  // 获取用户管理的部门根ID列表（包含 department_id 和 managed_department_ids）
  getManagedDepartmentIds(user: { department_id: number | null; managed_department_ids: any }): number[] {
    const ids = new Set<number>();
    if (user.department_id) {
      ids.add(user.department_id);
    }
    if (user.managed_department_ids) {
      const managed = typeof user.managed_department_ids === 'string'
        ? JSON.parse(user.managed_department_ids)
        : user.managed_department_ids;
      if (Array.isArray(managed)) {
        managed.forEach((id: number) => ids.add(id));
      }
    }
    return Array.from(ids);
  }

  // 递归获取某个/多个部门及其所有子部门的ID列表
  async getAllSubDepartmentIds(departmentIdOrIds: number | number[]): Promise<number[]> {
    const deptIds = Array.isArray(departmentIdOrIds) ? departmentIdOrIds : [departmentIdOrIds];
    const resultSet = new Set<number>();

    for (const departmentId of deptIds) {
      const ids = await this.collectSubDepartmentIds(departmentId);
      ids.forEach(id => resultSet.add(id));
    }

    return Array.from(resultSet);
  }

  private async collectSubDepartmentIds(departmentId: number): Promise<number[]> {
    const result: number[] = [departmentId];
    
    const children = await this.prisma.department.findMany({
      where: { parent_id: departmentId },
    });

    for (const child of children) {
      const subIds = await this.collectSubDepartmentIds(child.department_id);
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
