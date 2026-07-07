import { IsOptional, IsString, IsEnum } from 'class-validator';
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
  department_id?: number | null;

  @IsOptional()
  functional_supervisor_id?: number | null;

  @IsOptional()
  business_supervisor_id?: number | null;

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
