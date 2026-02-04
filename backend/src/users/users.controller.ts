import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../entities';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  async findAll(
    @Request() req: any,
    @Query('departmentId') departmentId?: number,
    @Query('role') role?: UserRole,
  ) {
    return this.usersService.findAll(req.user.userId, { departmentId, role });
  }

  @Get('me')
  async getMe(@Request() req: any) {
    return this.usersService.findOne(req.user.userId);
  }

  @Get('hierarchy')
  async getHierarchy(@Request() req: any) {
    return this.usersService.getHierarchy(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.usersService.findOne(id);
  }

  @Get(':id/subordinates')
  async findSubordinates(@Param('id') id: number) {
    return this.usersService.findSubordinates(id);
  }

  @Post()
  async create(@Request() req: any, @Body() createUserDto: CreateUserDto) {
    return this.usersService.create(req.user.userId, createUserDto);
  }

  @Put(':id')
  async update(@Request() req: any, @Param('id') id: number, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(req.user.userId, id, updateUserDto);
  }

  @Delete(':id')
  async delete(@Request() req: any, @Param('id') id: number) {
    return this.usersService.delete(req.user.userId, id);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importFromExcel(@UploadedFile() file: Express.Multer.File) {
    return this.usersService.importFromExcel(file.buffer);
  }
}
