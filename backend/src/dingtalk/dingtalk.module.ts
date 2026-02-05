import { Module } from '@nestjs/common';
import { DingtalkService } from './dingtalk.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DingtalkService],
  exports: [DingtalkService],
})
export class DingtalkModule {}
