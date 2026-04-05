import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  async signup(dto: { email: string; password: string; username?: string }) {
    const client = this.supabase.getClient();

    const { data, error } = await client.auth.signUp({
      email: dto.email,
      password: dto.password,
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new ConflictException('이미 사용 중인 이메일입니다.');
      }
      throw new ConflictException(error.message);
    }

    // profiles 테이블에 username 저장
    if (data.user && dto.username) {
      await client
        .from('profiles')
        .upsert({ id: data.user.id, username: dto.username });
    }

    return { message: '회원가입이 완료되었습니다.' };
  }

  async login(dto: { email: string; password: string }) {
    const client = this.supabase.getClient();

    const { data, error } = await client.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const { data: profile } = await client
      .from('profiles')
      .select('username')
      .eq('id', data.user.id)
      .single();

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      token_type: 'bearer',
      user: {
        id: data.user.id,
        email: data.user.email,
        username: profile?.username || null,
      },
    };
  }

  async getMe(accessToken: string) {
    const client = this.supabase.getClient();

    const { data: { user }, error } = await client.auth.getUser(accessToken);

    if (error || !user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    const { data: profile } = await client
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    return {
      id: user.id,
      email: user.email,
      username: profile?.username || null,
      created_at: user.created_at,
    };
  }
}
