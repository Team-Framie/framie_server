import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization;

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('인증 토큰이 필요합니다.');
    }

    const token = auth.replace('Bearer ', '');
    const client = this.supabase.getClient();
    const { data: { user }, error } = await client.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    request.user = user;
    request.token = token;
    return true;
  }
}
