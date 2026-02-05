import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateDingtalkAppDto {
  @IsNotEmpty({ message: '所属组织不能为空' })
  @IsString()
  organization: string;

  @IsNotEmpty({ message: '应用名称不能为空' })
  @IsString()
  app_name: string;

  @IsNotEmpty({ message: 'AgentId不能为空' })
  @IsString()
  agent_id: string;

  @IsNotEmpty({ message: 'CorpId不能为空' })
  @IsString()
  corp_id: string;

  @IsNotEmpty({ message: 'AppKey不能为空' })
  @IsString()
  app_key: string;

  @IsNotEmpty({ message: 'AppSecret不能为空' })
  @IsString()
  app_secret: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
