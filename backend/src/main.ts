import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOriginsFromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  
  // 全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  
  // 启用 CORS：默认支持本地/内网，同时允许通过 CORS_ORIGINS 扩展生产域名
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins: Array<string | RegExp> = [
        'http://localhost:3000',
        'http://localhost:5000',
        'http://localhost',
        'https://localhost:3000',
        'https://localhost:5000',
        'https://localhost',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5000',
        'http://127.0.0.1',
        'https://127.0.0.1:3000',
        'https://127.0.0.1:5000',
        'https://127.0.0.1',
        'https://pbc.das-security.cn',
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,  // 192.168.x.x
        /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,  // 10.x.x.x
        /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,  // 172.16.x.x-172.31.x.x
        /^https:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,  // https 192.168.x.x
        /^https:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,  // https 10.x.x.x
        /^https:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,  // https 172.16.x.x-172.31.x.x
        ...corsOriginsFromEnv,
      ];
      
      // 如果没有origin（例如postman等工具），允许访问
      if (!origin) {
        callback(null, true);
        return;
      }
      
      // 检查是否在允许列表中
      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        } else {
          return allowed.test(origin);
        }
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });
  
  // 设置全局前缀
  app.setGlobalPrefix('api');
  
  await app.listen(3001);
  console.log('PBC管理系统后端运行在 http://localhost:3001');
}
bootstrap();
