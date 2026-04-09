import { randomBytes } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class SessionsService {
  constructor(private readonly supabase: SupabaseService) {}

  // 기존 6자리 유지 (DB character(6) 제약), Math.random 대신 crypto.randomBytes 사용
  // 36^6 ≈ 2.1억 조합 + CSPRNG → 기존 대비 엔트로피 및 예측 불가능성 개선
  private generateShareCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from(randomBytes(6))
      .map((b) => chars[b % chars.length])
      .join('');
  }

  async create(userId: string, token: string, dto: CreateSessionDto) {
    const client = this.supabase.getClientForUser(token);

    // 1. 고유 공유 코드 생성
    let shareCode = this.generateShareCode();
    let { data: existing } = await client
      .from('share_codes')
      .select('id')
      .eq('code', shareCode)
      .maybeSingle();

    while (existing) {
      shareCode = this.generateShareCode();
      ({ data: existing } = await client
        .from('share_codes')
        .select('id')
        .eq('code', shareCode)
        .maybeSingle());
    }

    // 2. share_code 레코드 생성
    const { data: shareCodeData, error: shareErr } = await client
      .from('share_codes')
      .insert({ code: shareCode, created_by: userId })
      .select('id')
      .single();

    if (shareErr) throw new Error(shareErr.message);

    // 3. 세션 생성
    const { data: session, error: sessionErr } = await client
      .from('photo_sessions')
      .insert({
        frame_id: dto.frame_id,
        photographer_id: userId,
        frame_owner_id: dto.frame_owner_id || userId,
        source_type: dto.source_type || null,
        user_message: dto.user_message || null,
        result_image_path: dto.result_image_path || null,
        result_thumbnail_path: dto.result_thumbnail_path || null,
        is_saved: dto.is_saved ?? true,
        share_code_id: shareCodeData.id,
        display_user_id: dto.display_user_id || null,
      })
      .select('id')
      .single();

    if (sessionErr) throw new Error(sessionErr.message);

    // 4. share_code에 session_id 연결
    const { data: updData, error: updErr } = await client
      .from('share_codes')
      .update({ session_id: session.id })
      .eq('id', shareCodeData.id)
      .select();

    if (updErr) {
      console.error('[SessionsService] share_codes update error:', updErr);
      throw new Error('share_codes update failed: ' + updErr.message);
    }
    console.log('[SessionsService] share_codes updated:', updData);

    // 5. 사진 저장
    if (dto.photos?.length) {
      const photos = dto.photos.map((p) => ({
        session_id: session.id,
        shot_order: p.shot_order,
        original_path: p.original_path || null,
        processed_path: p.processed_path || null,
        is_transparent_png: p.is_transparent_png ?? false,
      }));

      const { error: photoErr } = await client
        .from('session_photos')
        .insert(photos);

      if (photoErr) throw new Error(photoErr.message);
    }

    return {
      session_id: session.id,
      share_code: shareCode,
    };
  }

  async findAllByUser(userId: string, page = 1, limit = 20) {
    const client = this.supabase.getClient();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await client
      .from('photo_sessions')
      .select('*, frame:frames(*), photos:session_photos(*), share_codes(*)', { count: 'exact' })
      .eq('photographer_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);

    return { sessions: data, total: count, page, limit };
  }

  async findOne(id: string, userId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('photo_sessions')
      .select('*, frame:frames(*), photos:session_photos(*), share_codes(*)')
      .eq('id', id)
      .eq('photographer_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('세션을 찾을 수 없습니다.');
    }
    return data;
  }
}
