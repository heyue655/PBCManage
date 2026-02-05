import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DingtalkAppService } from './dingtalk-app.service';
import { CreateDingtalkAppDto } from './dto/create-dingtalk-app.dto';
import { UpdateDingtalkAppDto } from './dto/update-dingtalk-app.dto';

/**
 * 钉钉应用配置管理接口
 * 权限要求：经理及以上（manager, assistant, gm）
 */
@Controller('dingtalk-apps')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DingtalkAppController {
  constructor(private readonly dingtalkAppService: DingtalkAppService) {}

  /**
   * 获取所有钉钉应用配置
   */
  @Get()
  @Roles('manager', 'assistant', 'gm')
  findAll() {
    return this.dingtalkAppService.findAll();
  }

  /**
   * 根据ID获取钉钉应用配置
   */
  @Get(':id')
  @Roles('manager', 'assistant', 'gm')
  findOne(@Param('id') id: string) {
    return this.dingtalkAppService.findOne(+id);
  }

  /**
   * 创建钉钉应用配置
   */
  @Post()
  @Roles('manager', 'assistant', 'gm')
  create(@Body() createDto: CreateDingtalkAppDto) {
    return this.dingtalkAppService.create(createDto);
  }

  /**
   * 更新钉钉应用配置
   */
  @Put(':id')
  @Roles('manager', 'assistant', 'gm')
  update(@Param('id') id: string, @Body() updateDto: UpdateDingtalkAppDto) {
    return this.dingtalkAppService.update(+id, updateDto);
  }

  /**
   * 删除钉钉应用配置
   */
  @Delete(':id')
  @Roles('manager', 'assistant', 'gm')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.dingtalkAppService.remove(+id);
  }

  /**
   * 切换应用启用状态
   */
  @Put(':id/toggle')
  @Roles('manager', 'assistant', 'gm')
  toggleActive(@Param('id') id: string) {
    return this.dingtalkAppService.toggleActive(+id);
  }
}
