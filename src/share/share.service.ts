import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

const BUCKET = 'photo-results';
const SIGNED_URL_TTL = 3600; // 1시간 — 코드 열거 후 재사용 가능한 시간 최소화

@Injectable()
export class ShareService {
  constructor(private readonly supabase: SupabaseService) {}

  private maskUsername(username: string): string {
    const visible = username.slice(0, 2);
    const maskedCount = Math.max(username.length - 2, 2);
    return `${visible}${'*'.repeat(maskedCount)}`;
  }

  async findByCode(code: string) {
    const client = this.supabase.getClient();

    const { data: shareCode, error } = await client
      .from('share_codes')
      .select('*, session:photo_sessions!photo_sessions_share_code_id_fkey(*, frame:frames(*), photos:session_photos(*))')
      .eq('code', code)
      .single();

    if (error || !shareCode) {
      throw new NotFoundException('공유 코드를 찾을 수 없습니다.');
    }

    const sessionArr = shareCode.session as any[] | null;
    const raw = Array.isArray(sessionArr) ? sessionArr[0] : sessionArr;

    if (!raw) {
      throw new NotFoundException('세션을 찾을 수 없습니다.');
    }

    // raw 경로를 직접 노출하지 않고 서명된 단기 URL로 교체
    // (photo-results 버킷을 Private으로 설정 시 완전한 보호)
    const admin = this.supabase.getAdminClient();

    // 프레임 합성에 사용할 이미지: 투명 PNG(processed)를 우선, 없으면 원본
    const photos = await Promise.all(
      ((raw.photos ?? []) as any[]).map(async (photo: any) => {
        const { original_path, processed_path, ...rest } = photo;
        const sourcePath = processed_path ?? original_path;
        const signedUrl = sourcePath
          ? (await admin.storage.from(BUCKET).createSignedUrl(sourcePath, SIGNED_URL_TTL)).data?.signedUrl
          : null;
        return { ...rest, photo_url: signedUrl ?? null };
      }),
    );

    const resultSignedUrl = raw.result_image_path
      ? (await admin.storage.from(BUCKET).createSignedUrl(raw.result_image_path, SIGNED_URL_TTL)).data?.signedUrl
      : null;

    // 제작자 username만 노출 (UUID 직접 노출 금지 — 사용자 열거 방지)
    const creatorId = raw.display_user_id ?? raw.photographer_id ?? null;
    let creatorUsername: string | null = null;
    if (creatorId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('username')
        .eq('id', creatorId)
        .maybeSingle();
      creatorUsername = profile?.username ? this.maskUsername(profile.username) : null;
    }

    const { photographer_id, result_image_path, result_thumbnail_path, display_user_id, ...safeSession } = raw;

    return {
      session: {
        ...safeSession,
        photos,
        result_image_url: resultSignedUrl ?? null,
        creator_username: creatorUsername,
      },
    };
  }
}
