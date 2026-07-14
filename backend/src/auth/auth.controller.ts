import { Controller, Post, Get, Body, Query, UseGuards, Request, Ip, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DaslinkService } from '../daslink/daslink.service';
import { LoginDto, ChangePasswordDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private daslinkService: DaslinkService,
  ) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Ip() ip: string) {
    return this.authService.login(loginDto, ip);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout() {
    return { message: '登出成功' };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.userId, changePasswordDto);
  }

  /** Check if DASLink SSO is enabled */
  @Get('daslink/status')
  getDaslinkStatus() {
    return { enabled: this.daslinkService.enabled };
  }

  /** Get DASLink OAuth login URL */
  @Get('daslink/login-url')
  getDaslinkLoginUrl(@Query('callbackUrl') callbackUrl: string) {
    if (!this.daslinkService.enabled) {
      throw new BadRequestException('DASLink SSO is not enabled');
    }
    if (!callbackUrl) {
      throw new BadRequestException('callbackUrl is required');
    }
    const url = this.daslinkService.getLoginUrl(callbackUrl);
    return { url };
  }

  /** DASLink SSO callback — exchange code for JWT */
  @Get('daslink/callback')
  async daslinkCallback(@Query('code') code: string, @Ip() ip: string) {
    if (!this.daslinkService.enabled) {
      throw new BadRequestException('DASLink SSO is not enabled');
    }
    if (!code) {
      throw new BadRequestException('code is required');
    }
    return this.authService.daslinkLogin(code, ip);
  }
}
