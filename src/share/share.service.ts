import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class ShareService {
  constructor(private readonly supabase: SupabaseService) {}

  async findByCode(code: string) {
    const client = this.supabase.getClient();

    const { data: shareCode, error } = await client
      .from('share_codes')
      .select('*, session:photo_sessions!photo_sessions_share_code_id_fkey(*, frame:frames(*), photos:session_photos(*))')
      .eq('code', code)
      .single();

    if (error) {
      console.error('[ShareService] error:', error);
      throw new NotFoundException('공유 코드를 찾을 수 없습니다.');
    }
    if (!shareCode) {
      console.error('[ShareService] no data found for code:', code);
      throw new NotFoundException('공유 코드를 찾을 수 없습니다.');
    }

    // one-to-many FK이므로 배열로 옴 → 첫 번째 세션 사용
    const sessionArr = shareCode.session as any[] | null;
    const session = Array.isArray(sessionArr) ? sessionArr[0] : sessionArr;

    if (!session) {
      throw new NotFoundException('세션을 찾을 수 없습니다.');
    }

    return { session };
  }
}
