import { Module } from '@nestjs/common';
import { PbcService } from './pbc.service';
import { PbcController } from './pbc.controller';
import { DingtalkModule } from '../dingtalk/dingtalk.module';

@Module({
  imports: [DingtalkModule],
  controllers: [PbcController],
  providers: [PbcService],
  exports: [PbcService],
})
export class PbcModule {}
