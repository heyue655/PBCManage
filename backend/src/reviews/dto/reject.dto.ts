import { IsNotEmpty, IsString } from 'class-validator';

export class RejectDto {
  @IsNotEmpty({ message: '驳回原因不能为空' })
  @IsString()
  reason: string;
}
