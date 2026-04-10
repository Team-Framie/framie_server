import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

interface LoginAttemptRecord {
  count: number;
  lockedUntil: number;
}

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  // 계정 단위 로그인 시도 추적 (프로덕션에서는 Redis 사용 권장)
  private readonly loginAttempts = new Map<string, LoginAttemptRecord>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_MS = 15 * 60 * 1000; // 15분

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private checkLoginLock(email: string): void {
    const normalizedEmail = this.normalizeEmail(email);
    const record = this.loginAttempts.get(normalizedEmail);
    if (!record) return;
    const now = Date.now();
    if (now < record.lockedUntil) {
      const remaining = Math.ceil((record.lockedUntil - now) / 60_000);
      throw new HttpException(
        `로그인 시도가 너무 많습니다. ${remaining}분 후 다시 시도해주세요.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // 잠금 해제 — 카운터 초기화
    if (now >= record.lockedUntil && record.lockedUntil > 0) {
      this.loginAttempts.delete(normalizedEmail);
    }
  }

  private recordFailedLogin(email: string): void {
    const normalizedEmail = this.normalizeEmail(email);
    const now = Date.now();
    const record = this.loginAttempts.get(normalizedEmail) ?? { count: 0, lockedUntil: 0 };
    record.count += 1;
    if (record.count >= this.MAX_ATTEMPTS) {
      record.lockedUntil = now + this.LOCKOUT_MS;
    }
    this.loginAttempts.set(normalizedEmail, record);
  }

  private clearLoginRecord(email: string): void {
    const normalizedEmail = this.normalizeEmail(email);
    this.loginAttempts.delete(normalizedEmail);
  }

  async signup(dto: { email: string; password: string; username?: string }) {
    const client = this.supabase.getClient();

    const { data, error } = await client.auth.signUp({
      email: dto.email,
      password: dto.password,
    });

    if (error) {
      if (error.message.includes('already registered')) {
        // Supabase는 기존 계정에 대해 확인 메일을 재발송하지 않으므로
        // 클라이언트에는 동일한 성공 응답을 반환해 이메일 열거를 방지한다.
        console.warn('[AuthService] 이미 등록된 이메일로 회원가입 시도:', dto.email);
        return { message: '회원가입이 완료되었습니다. 이메일을 확인해주세요.' };
      }
      throw new ConflictException(error.message);
    }

    // profiles 테이블에 username 저장
    if (data.user && dto.username) {
      const { error: profileErr } = await client
        .from('profiles')
        .upsert({ id: data.user.id, username: dto.username });

      if (profileErr) {
        // PostgreSQL unique 제약 위반 (username 중복)
        if (profileErr.code === '23505') {
          throw new ConflictException('이미 사용 중인 사용자 이름입니다.');
        }
        // 기타 에러는 로그만 기록 — 회원가입 자체는 성공 처리
        console.error('[AuthService] 프로필 저장 실패:', profileErr.message);
      }
    }

    return { message: '회원가입이 완료되었습니다. 이메일을 확인해주세요.' };
  }

  async login(dto: { email: string; password: string }) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    this.checkLoginLock(normalizedEmail);

    const client = this.supabase.getClient();

    const { data, error } = await client.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error) {
      this.recordFailedLogin(normalizedEmail);
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    this.clearLoginRecord(normalizedEmail);

    const { data: profile } = await client
      .from('profiles')
      .select('username')
      .eq('id', data.user.id)
      .single();

    // refresh_token은 응답 바디에 포함하지 않음 (로그 노출 방지)
    // 프론트엔드는 supabase.auth.signInWithPassword()를 직접 사용할 것
    return {
      access_token: data.session.access_token,
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
