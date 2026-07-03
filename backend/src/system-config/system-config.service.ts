import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemConfigService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const configs = await this.prisma.systemConfig.findMany();
    const result: Record<string, any> = {};
    for (const c of configs) {
      result[c.config_key] = c.config_value;
    }
    return result;
  }

  async update(key: string, value: string) {
    const config = await this.prisma.systemConfig.findUnique({
      where: { config_key: key },
    });
    if (!config) {
      throw new NotFoundException(`配置项 ${key} 不存在`);
    }
    await this.prisma.systemConfig.update({
      where: { config_key: key },
      data: { config_value: value },
    });
    return { config_key: key, config_value: value };
  }

  async getWeightRatio(): Promise<{ functional: number; business: number }> {
    const configs = await this.findAll();
    const functional = parseInt(configs['evaluation_weight_functional'] || '30', 10);
    const business = parseInt(configs['evaluation_weight_business'] || '70', 10);
    return { functional, business };
  }
}
