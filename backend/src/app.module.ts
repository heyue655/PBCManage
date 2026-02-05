import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { PbcModule } from './pbc/pbc.module';
import { ReviewsModule } from './reviews/reviews.module';
import { DingtalkAppModule } from './dingtalk-app/dingtalk-app.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    PbcModule,
    ReviewsModule,
    DingtalkAppModule,
  ],
})
export class AppModule {}
