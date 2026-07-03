import { Controller, Get, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('system-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemConfigController {
  constructor(private systemConfigService: SystemConfigService) {}

  @Get()
  @Roles('gm')
  async findAll() {
    return this.systemConfigService.findAll();
  }

  @Put(':key')
  @Roles('gm')
  async update(@Param('key') key: string, @Body() body: { value: string }) {
    return this.systemConfigService.update(key, body.value);
  }
}
