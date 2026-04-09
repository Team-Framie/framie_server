import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { SupabaseModule } from './common/supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { FramesModule } from './frames/frames.module';
import { ImagesModule } from './images/images.module';
import { SessionsModule } from './sessions/sessions.module';
import { ShareModule } from './share/share.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 전역 Rate Limit: 1분에 최대 60회 (로그인은 별도로 더 엄격하게 적용)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    SupabaseModule,
    AuthModule,
    FramesModule,
    ImagesModule,
    SessionsModule,
    ShareModule,
    UsersModule,
  ],
})
export class AppModule {}
