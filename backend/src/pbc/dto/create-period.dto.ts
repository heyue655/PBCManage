import { IsNotEmpty, IsNumber, IsDateString } from 'class-validator';

export class CreatePeriodDto {
  @IsNotEmpty({ message: '年份不能为空' })
  @IsNumber()
  year: number;

  @IsNotEmpty({ message: '季度不能为空' })
  @IsNumber()
  quarter: number;

  @IsNotEmpty({ message: '开始日期不能为空' })
  @IsDateString()
  start_date: string;

  @IsNotEmpty({ message: '结束日期不能为空' })
  @IsDateString()
  end_date: string;
}
