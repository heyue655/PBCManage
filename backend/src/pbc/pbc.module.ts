import { Module } from '@nestjs/common';
import { PbcService } from './pbc.service';
import { PbcController } from './pbc.controller';

@Module({
  controllers: [PbcController],
  providers: [PbcService],
  exports: [PbcService],
})
export class PbcModule {}
