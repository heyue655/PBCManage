import { Module } from '@nestjs/common';
import { PbcService } from './pbc.service';
import { PbcController } from './pbc.controller';
import { DingtalkModule } from '../dingtalk/dingtalk.module';
import { PerformanceModule } from '../performance/performance.module';

@Module({
  imports: [DingtalkModule, PerformanceModule],
  controllers: [PbcController],
  providers: [PbcService],
  exports: [PbcService],
})
export class PbcModule {}
