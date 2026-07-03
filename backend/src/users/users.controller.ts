import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Request, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../entities';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async findAll(
    @Request() req: any,
    @Query('departmentId') departmentId?: string,
    @Query('role') role?: UserRole,
    @Query('realName') realName?: string,
    @Query('jobTitle') jobTitle?: string,
    @Query('organization') organization?: string,
  ) {
    return this.usersService.findAll(req.user.userId, {
      departmentId: departmentId ? +departmentId : undefined,
      role,
      realName,
      jobTitle,
      organization,
    });
  }

  @Get('me')
  async getMe(@Request() req: any) {
    return this.usersService.findOne(req.user.userId);
  }

  @Get('me/is-supervisor')
  async isSupervisor(@Request() req: any) {
    const subordinates = await this.prisma.user.findMany({
      where: {
        OR: [
          { functional_supervisor_id: req.user.userId },
          { business_supervisor_id: req.user.userId },
        ],
      },
      take: 1,
    });
    return { isSupervisor: subordinates.length > 0 };
  }

  @Get('hierarchy')
  async getHierarchy(@Request() req: any) {
    return this.usersService.getHierarchy(req.user.userId);
  }

  @Get('import-template')
  async downloadImportTemplate(@Res() res: Response) {
    const buffer = this.usersService.generateImportTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=user_import_template.xlsx',
    });
    res.send(buffer);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Get(':id/subordinates')
  async findSubordinates(@Param('id') id: string) {
    return this.usersService.findSubordinates(+id);
  }

  @Post()
  async create(@Request() req: any, @Body() createUserDto: CreateUserDto) {
    return this.usersService.create(req.user.userId, createUserDto);
  }

  @Put(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(req.user.userId, +id, updateUserDto);
  }

  @Delete(':id')
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.usersService.delete(req.user.userId, +id);
  }

  @Post(':id/reset-password')
  async resetPassword(@Request() req: any, @Param('id') id: string) {
    return this.usersService.resetPassword(req.user.userId, +id);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importFromExcel(@UploadedFile() file: Express.Multer.File) {
    return this.usersService.importFromExcel(file.buffer);
  }
}
