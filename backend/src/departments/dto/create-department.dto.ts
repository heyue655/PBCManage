import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateDepartmentDto {
  @IsNotEmpty({ message: '部门名称不能为空' })
  @IsString()
  department_name: string;

  @IsOptional()
  @IsNumber()
  parent_id?: number;
}
