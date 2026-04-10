import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async getStats(userId: string, token: string) {
    const client = this.supabase.getClientForUser(token);

    const { count: savedSessionsCount } = await client
      .from('photo_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('photographer_id', userId)
      .eq('is_saved', true);

    const { count: totalPhotosCount } = await client
      .from('session_photos')
      .select('*, session:photo_sessions!inner(*)', { count: 'exact', head: true })
      .eq('session.photographer_id', userId);

    return {
      saved_sessions_count: savedSessionsCount || 0,
      total_photos_count: totalPhotosCount || 0,
    };
  }

  async getRecentSessions(userId: string, token: string, limit = 10) {
    const client = this.supabase.getClientForUser(token);

    const { data, error } = await client
      .from('photo_sessions')
      .select('*, frame:frames(*), photos:session_photos(*), share_code:share_codes!share_code_id(*)')
      .eq('photographer_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    // Private 버킷 — raw 경로 대신 단기 서명된 URL 반환
    const sessions = await this.supabase.addSignedUrlsToSessions(data ?? [], userId);
    return { sessions };
  }
}
