import { Module } from '@nestjs/common';
import { DaslinkService } from './daslink.service';

@Module({
  providers: [DaslinkService],
  exports: [DaslinkService],
})
export class DaslinkModule {}
