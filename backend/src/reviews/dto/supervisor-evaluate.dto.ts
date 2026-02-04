import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class SupervisorEvaluateDto {
  @IsNotEmpty({ message: '评分不能为空' })
  @IsNumber()
  @Min(0, { message: '评分最小为0' })
  @Max(100, { message: '评分最大为100' })
  score: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
