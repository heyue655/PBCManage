import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  // 所有角色都可以查看
  @Get()
  async findAll(@Request() req: any) {
    return this.departmentsService.findAll(req.user.userId);
  }

  @Get('tree')
  async getTree() {
    return this.departmentsService.getTree();
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.departmentsService.findOne(id);
  }

  // 只有总经理可以创建
  @Post()
  async create(@Request() req: any, @Body() createDepartmentDto: CreateDepartmentDto) {
    if (req.user.role !== 'gm') {
      throw new ForbiddenException('只有总经理可以创建部门');
    }
    return this.departmentsService.create(createDepartmentDto);
  }

  // 只有总经理可以修改
  @Put(':id')
  async update(@Request() req: any, @Param('id') id: number, @Body() updateDepartmentDto: UpdateDepartmentDto) {
    if (req.user.role !== 'gm') {
      throw new ForbiddenException('只有总经理可以修改部门');
    }
    return this.departmentsService.update(id, updateDepartmentDto);
  }

  // 只有总经理可以删除
  @Delete(':id')
  async delete(@Request() req: any, @Param('id') id: number) {
    if (req.user.role !== 'gm') {
      throw new ForbiddenException('只有总经理可以删除部门');
    }
    return this.departmentsService.delete(id);
  }
}
