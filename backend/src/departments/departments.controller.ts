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
  async findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(+id);
  }

  // 总经理和助理可以创建
  @Post()
  async create(@Request() req: any, @Body() createDepartmentDto: CreateDepartmentDto) {
    if (req.user.role !== 'gm' && req.user.role !== 'assistant') {
      throw new ForbiddenException('只有总经理和助理可以创建部门');
    }
    return this.departmentsService.create(createDepartmentDto);
  }

  // 总经理和助理可以修改
  @Put(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() updateDepartmentDto: UpdateDepartmentDto) {
    if (req.user.role !== 'gm' && req.user.role !== 'assistant') {
      throw new ForbiddenException('只有总经理和助理可以修改部门');
    }
    return this.departmentsService.update(+id, updateDepartmentDto);
  }

  // 只有总经理可以删除
  @Delete(':id')
  async delete(@Request() req: any, @Param('id') id: string) {
    if (req.user.role !== 'gm') {
      throw new ForbiddenException('只有总经理可以删除部门');
    }
    return this.departmentsService.delete(+id);
  }
}
