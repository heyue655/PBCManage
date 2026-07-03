import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { DingtalkModule } from '../dingtalk/dingtalk.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [DingtalkModule, SystemConfigModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
