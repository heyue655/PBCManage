import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { GoalType } from '../../entities';

export class CreatePbcDto {
  @IsOptional()
  @IsNumber()
  period_id?: number;

  @IsNotEmpty({ message: '目标类型不能为空' })
  @IsEnum(GoalType)
  goal_type: GoalType;

  @IsNotEmpty({ message: '目标名称不能为空' })
  @IsString()
  goal_name: string;

  @IsNotEmpty({ message: '目标描述不能为空' })
  @IsString()
  goal_description: string;

  @IsNotEmpty({ message: '目标权重不能为空' })
  @IsNumber()
  goal_weight: number;

  @IsOptional()
  @IsNumber()
  supervisor_goal_id?: number;

  @IsOptional()
  @IsString()
  measures?: string;

  @IsOptional()
  @IsString()
  unacceptable?: string;

  @IsOptional()
  @IsString()
  acceptable?: string;

  @IsOptional()
  @IsString()
  excellent?: string;

  @IsOptional()
  @IsDateString()
  completion_time?: string;
}
