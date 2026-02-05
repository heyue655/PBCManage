import { Module } from '@nestjs/common';
import { DingtalkService } from './dingtalk.service';

@Module({
  providers: [DingtalkService],
  exports: [DingtalkService],
})
export class DingtalkModule {}
