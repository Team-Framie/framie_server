import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class SessionsService {
  constructor(private readonly supabase: SupabaseService) {}

  // DB 제약: character(6), share_code_format_check ([A-Z]{3}[0-9]{3})
  // Math.random 대신 crypto.randomBytes로 예측 불가능한 코드 생성
  private generateShareCode(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const bytes = randomBytes(6);
    const code =
      letters[bytes[0] % 26] +
      letters[bytes[1] % 26] +
      letters[bytes[2] % 26] +
      digits[bytes[3] % 10] +
      digits[bytes[4] % 10] +
      digits[bytes[5] % 10];
    return code;
  }

  async create(userId: string, token: string, dto: CreateSessionDto) {
    const client = this.supabase.getClientForUser(token);

    if (dto.photos?.length) {
      const userPathPrefix = `${userId}/`;
      for (const photo of dto.photos) {
        if (photo.original_path && !photo.original_path.startsWith(userPathPrefix)) {
          throw new BadRequestException('잘못된 original_path 입니다.');
        }
        if (photo.processed_path && !photo.processed_path.startsWith(userPathPrefix)) {
          throw new BadRequestException('잘못된 processed_path 입니다.');
        }
      }
    }

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

    // 3~5. 세션·사진 생성 — 실패 시 share_code 롤백 (보상 트랜잭션)
    let sessionId: string | null = null;
    try {
      // 3. 세션 생성
      // frame_owner_id는 클라이언트 값을 신뢰하지 않고 서버에서 고정
      const { data: session, error: sessionErr } = await client
        .from('photo_sessions')
        .insert({
          frame_id: dto.frame_id,
          photographer_id: userId,
          frame_owner_id: userId,
          source_type: dto.source_type || null,
          user_message: dto.user_message || null,
          result_image_path: dto.result_image_path || null,
          result_thumbnail_path: dto.result_thumbnail_path || null,
          is_saved: dto.is_saved ?? true,
          share_code_id: shareCodeData.id,
          display_user_id: userId,
        })
        .select('id')
        .single();

      if (sessionErr) throw new Error(sessionErr.message);
      sessionId = session.id;

      // 4. share_code에 session_id 연결
      const { error: updErr } = await client
        .from('share_codes')
        .update({ session_id: session.id })
        .eq('id', shareCodeData.id);

      if (updErr) throw new Error(updErr.message);

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

      return { session_id: session.id, share_code: shareCode };
    } catch (err) {
      // 보상 트랜잭션: 생성된 레코드 정리 (순서 역순)
      if (sessionId) {
        try { await client.from('photo_sessions').delete().eq('id', sessionId); } catch {}
      }
      try { await client.from('share_codes').delete().eq('id', shareCodeData.id); } catch {}
      throw err;
    }
  }

  async findAllByUser(userId: string, token: string, page = 1, limit = 20) {
    const client = this.supabase.getClientForUser(token);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await client
      .from('photo_sessions')
      .select('*, frame:frames(*), photos:session_photos(*), share_codes(*)', { count: 'exact' })
      .eq('photographer_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);

    const sessions = await this.supabase.addSignedUrlsToSessions(data ?? [], userId);
    return { sessions, total: count, page, limit };
  }

  async findOne(id: string, userId: string, token: string) {
    const client = this.supabase.getClientForUser(token);

    const { data, error } = await client
      .from('photo_sessions')
      .select('*, frame:frames(*), photos:session_photos(*), share_codes(*)')
      .eq('id', id)
      .eq('photographer_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('세션을 찾을 수 없습니다.');
    }

    const [withUrls] = await this.supabase.addSignedUrlsToSessions([data], userId);
    return withUrls;
  }
}
