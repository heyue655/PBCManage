import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';
import { UserRole } from '../../entities';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  real_name?: string;

  @IsOptional()
  @IsString()
  job_title?: string;

  @IsOptional()
  @IsNumber()
  department_id?: number;

  @IsOptional()
  @IsNumber()
  functional_supervisor_id?: number;

  @IsOptional()
  @IsNumber()
  business_supervisor_id?: number;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  organization?: string;

  @IsOptional()
  @IsString()
  dingtalk_userid?: string;
}
