import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  department_name?: string;

  @IsOptional()
  @IsNumber()
  parent_id?: number;
}
