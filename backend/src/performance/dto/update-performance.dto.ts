import { IsOptional, IsString, IsBoolean, IsDateString } from 'class-validator';

export class UpdatePerformanceDto {
  @IsOptional()
  @IsString()
  performance_level?: string;

  @IsOptional()
  @IsBoolean()
  has_ai_contribution?: boolean;

  @IsOptional()
  @IsString()
  ai_performance_comment?: string;

  @IsOptional()
  @IsString()
  bottom_mgmt_status?: string;

  @IsOptional()
  @IsDateString()
  planned_elimination_date?: string;
}
