import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, ChangePasswordDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto, ipAddress?: string) {
    const { username, password } = loginDto;
    
    console.log('=== 登录请求开始 ===');
    console.log('用户名:', username);
    console.log('密码长度:', password?.length);
    console.log('IP地址:', ipAddress);
    
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { department: true },
    });

    console.log('数据库查询结果:', user ? {
      user_id: user.user_id,
      username: user.username,
      real_name: user.real_name,
      role: user.role,
      password_hash: user.password?.substring(0, 20) + '...',
    } : '未找到用户');

    if (!user) {
      console.log('❌ 登录失败: 用户不存在');
      throw new UnauthorizedException('用户名或密码错误');
    }

    console.log('开始验证密码...');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('密码验证结果:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('❌ 登录失败: 密码错误');
      throw new UnauthorizedException('用户名或密码错误');
    }

    console.log('✅ 密码验证通过，记录登录日志...');
    
    // 记录登录日志
    await this.prisma.loginLog.create({
      data: {
        user_id: user.user_id,
        login_time: new Date(),
        ip_address: ipAddress,
      },
    });

    console.log('✅ 生成JWT Token...');
    
    // 生成JWT
    const payload = {
      userId: user.user_id,
      username: user.username,
      role: user.role,
    };

    const token = this.jwtService.sign(payload);
    console.log('✅ 登录成功!');
    console.log('=== 登录请求结束 ===\n');

    return {
      access_token: token,
      user: {
        user_id: user.user_id,
        username: user.username,
        real_name: user.real_name,
        job_title: user.job_title,
        role: user.role,
        department: user.department,
      },
    };
  }

  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('原密码错误');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { user_id: userId },
      data: { password: hashedPassword },
    });

    return { message: '密码修改成功' };
  }

  async validateUser(userId: number) {
    return this.prisma.user.findUnique({
      where: { user_id: userId },
      include: { department: true },
    });
  }
}
