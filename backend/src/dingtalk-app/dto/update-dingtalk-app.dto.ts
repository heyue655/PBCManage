import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateDingtalkAppDto {
  @IsOptional()
  @IsString()
  app_name?: string;

  @IsOptional()
  @IsString()
  agent_id?: string;

  @IsOptional()
  @IsString()
  corp_id?: string;

  @IsOptional()
  @IsString()
  app_key?: string;

  @IsOptional()
  @IsString()
  app_secret?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
