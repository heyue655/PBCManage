import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDingtalkAppDto } from './dto/create-dingtalk-app.dto';
import { UpdateDingtalkAppDto } from './dto/update-dingtalk-app.dto';

@Injectable()
export class DingtalkAppService {
  private readonly logger = new Logger(DingtalkAppService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 获取所有钉钉应用配置
   */
  async findAll() {
    return this.prisma.dingtalkApp.findMany({
      orderBy: { organization: 'asc' },
    });
  }

  /**
   * 根据组织获取钉钉应用配置
   */
  async findByOrganization(organization: string) {
    const app = await this.prisma.dingtalkApp.findUnique({
      where: { organization },
    });

    if (!app) {
      throw new NotFoundException(`组织 ${organization} 的钉钉应用配置不存在`);
    }

    if (!app.is_active) {
      this.logger.warn(`组织 ${organization} 的钉钉应用已禁用`);
    }

    return app;
  }

  /**
   * 根据ID获取钉钉应用配置
   */
  async findOne(id: number) {
    const app = await this.prisma.dingtalkApp.findUnique({
      where: { app_id: id },
    });

    if (!app) {
      throw new NotFoundException(`钉钉应用配置不存在`);
    }

    return app;
  }

  /**
   * 创建钉钉应用配置
   */
  async create(createDto: CreateDingtalkAppDto) {
    // 检查组织是否已存在
    const existing = await this.prisma.dingtalkApp.findUnique({
      where: { organization: createDto.organization },
    });

    if (existing) {
      throw new BadRequestException(`组织 ${createDto.organization} 的钉钉应用配置已存在`);
    }

    return this.prisma.dingtalkApp.create({
      data: createDto,
    });
  }

  /**
   * 更新钉钉应用配置
   */
  async update(id: number, updateDto: UpdateDingtalkAppDto) {
    await this.findOne(id); // 检查是否存在

    return this.prisma.dingtalkApp.update({
      where: { app_id: id },
      data: updateDto,
    });
  }

  /**
   * 删除钉钉应用配置
   */
  async remove(id: number) {
    await this.findOne(id); // 检查是否存在

    return this.prisma.dingtalkApp.delete({
      where: { app_id: id },
    });
  }

  /**
   * 切换应用启用状态
   */
  async toggleActive(id: number) {
    const app = await this.findOne(id);

    return this.prisma.dingtalkApp.update({
      where: { app_id: id },
      data: { is_active: !app.is_active },
    });
  }
}
