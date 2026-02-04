import { IsOptional, IsString, IsNumber, IsEnum, IsDateString } from 'class-validator';
import { GoalType } from '../../entities';

export class UpdatePbcDto {
  @IsOptional()
  @IsEnum(GoalType)
  goal_type?: GoalType;

  @IsOptional()
  @IsString()
  goal_name?: string;

  @IsOptional()
  @IsString()
  goal_description?: string;

  @IsOptional()
  @IsNumber()
  goal_weight?: number;

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
