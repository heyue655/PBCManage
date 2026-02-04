import { IsOptional, IsString } from 'class-validator';

export class ApproveDto {
  @IsOptional()
  @IsString()
  comments?: string;
}
