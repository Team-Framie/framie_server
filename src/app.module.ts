import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

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
