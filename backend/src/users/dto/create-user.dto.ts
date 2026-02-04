import { IsNotEmpty, IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { UserRole } from '../../entities';

export class CreateUserDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  @IsString()
  username: string;

  @IsNotEmpty({ message: '真实姓名不能为空' })
  @IsString()
  real_name: string;

  @IsNotEmpty({ message: '职位不能为空' })
  @IsString()
  job_title: string;

  @IsOptional()
  @IsNumber()
  department_id?: number;

  @IsOptional()
  @IsNumber()
  supervisor_id?: number;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
