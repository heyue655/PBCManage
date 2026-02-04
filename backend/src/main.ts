import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  
  // 启用CORS - 支持localhost和局域网IP访问
  app.enableCors({
    origin: (origin, callback) => {
      // 允许的来源：localhost、127.0.0.1、局域网IP（192.168.x.x、10.x.x.x等）
      // 开发环境允许所有来源，生产环境应该配置具体的域名
      const allowedOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/,  // 192.168.x.x:3000
        /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$/,  // 10.x.x.x:3000
        /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}:3000$/,  // 172.16.x.x-172.31.x.x:3000
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
