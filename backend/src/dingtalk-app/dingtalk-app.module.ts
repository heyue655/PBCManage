import { Module } from '@nestjs/common';
import { DingtalkAppController } from './dingtalk-app.controller';
import { DingtalkAppService } from './dingtalk-app.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DingtalkAppController],
  providers: [DingtalkAppService],
  exports: [DingtalkAppService],
})
export class DingtalkAppModule {}
