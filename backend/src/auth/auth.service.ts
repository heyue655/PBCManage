import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { DaslinkService } from '../daslink/daslink.service';
import { LoginDto, ChangePasswordDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private daslinkService: DaslinkService,
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

    // 检测是否使用默认密码登录
    const isDefaultPassword = password === '123456';

    return {
      access_token: token,
      needResetPassword: isDefaultPassword,
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

  async daslinkLogin(code: string, ipAddress?: string) {
    // 1. Exchange code for accessToken
    let tokenData;
    try {
      tokenData = await this.daslinkService.exchangeCode(code);
    } catch (err: any) {
      throw new UnauthorizedException(
        `DASLink 授权码验证失败：${err.message || '授权码已过期或无效，请重新登录'}`,
      );
    }

    // 2. Get user info from DASLink
    let daslinkUser;
    try {
      daslinkUser = await this.daslinkService.getUserInfo(tokenData.accessToken);
    } catch (err: any) {
      throw new UnauthorizedException(
        `DASLink 获取用户信息失败：${err.message || '请重新登录'}`,
      );
    }

    // 3. Match local user by userCode (= username in PBC)
    const user = await this.prisma.user.findUnique({
      where: { username: daslinkUser.code },
      include: { department: true },
    });

    if (!user) {
      throw new UnauthorizedException(
        `用户 ${daslinkUser.userName}(${daslinkUser.code}) 未在系统中注册，请联系管理员`,
      );
    }

    // 4. Update dingtalk_userid if DASLink returned one and local is empty
    if (daslinkUser.dingtalkId && !user.dingtalk_userid) {
      await this.prisma.user.update({
        where: { user_id: user.user_id },
        data: { dingtalk_userid: daslinkUser.dingtalkId },
      });
    }

    // 5. Record login log
    await this.prisma.loginLog.create({
      data: {
        user_id: user.user_id,
        login_time: new Date(),
        ip_address: ipAddress,
      },
    });

    // 6. Generate JWT (same as regular login)
    const payload = {
      userId: user.user_id,
      username: user.username,
      role: user.role,
    };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      needResetPassword: false,
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

  async validateUser(userId: number) {
    return this.prisma.user.findUnique({
      where: { user_id: userId },
      include: { department: true },
    });
  }
}
