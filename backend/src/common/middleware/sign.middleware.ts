import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class SignMiddleware implements NestMiddleware {
  private get enabled(): boolean {
    return process.env.SIGN_ENABLED === 'true';
  }

  private get signKey(): string {
    return process.env.SIGN_KEY || '';
  }

  private get toleranceMs(): number {
    return parseInt(process.env.SIGN_TOLERANCE_MS || '3600000', 10);
  }

  /** Paths that skip sign verification */
  private readonly whitelist: string[] = [
    '/api/auth/login',
    '/api/auth/daslink/login-url',
    '/api/auth/daslink/callback',
    '/api/auth/daslink/status',
  ];

  use(req: Request, _res: Response, next: NextFunction): void {
    if (!this.enabled) {
      return next();
    }

    // Skip OPTIONS preflight
    if (req.method === 'OPTIONS') {
      return next();
    }

    // Skip whitelisted paths
    const path = req.path;
    if (this.whitelist.some((w) => path.startsWith(w))) {
      return next();
    }

    const sign = req.headers['sign'] as string;
    const timestamp = req.headers['timestamp'] as string;
    const authHeader = (req.headers['authorization'] || '') as string;
    const token = authHeader.replace('Bearer ', '');

    if (!sign || !timestamp) {
      throw new UnauthorizedException('Missing sign or timestamp header');
    }

    // Check timestamp freshness
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > this.toleranceMs) {
      throw new UnauthorizedException('Request timestamp expired');
    }

    // Verify sign: MD5(uri + timestamp + key + token).toUpperCase()
    const uri = req.originalUrl || req.url;
    const signStr = `${uri}${timestamp}${this.signKey}${token}`;
    const expectedSign = crypto
      .createHash('md5')
      .update(signStr)
      .digest('hex')
      .toUpperCase();

    if (sign !== expectedSign) {
      throw new UnauthorizedException('Invalid sign');
    }

    next();
  }
}
