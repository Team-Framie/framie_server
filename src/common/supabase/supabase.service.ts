import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;
  private adminClient: SupabaseClient | null = null;
  private readonly url: string;
  private readonly anonKey: string;
  private readonly serviceKey: string;

  constructor(config: ConfigService) {
    this.url = config.get<string>('SUPABASE_URL', '');
    this.anonKey = config.get<string>('SUPABASE_ANON_KEY', '');
    this.serviceKey = config.get<string>('SUPABASE_SERVICE_KEY', '');
    this.client = createClient(this.url, this.anonKey);
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  getClientForUser(token: string): SupabaseClient {
    return createClient(this.url, this.anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }

  // 서명된 URL 생성 등 서버 전용 작업에 사용 (RLS 우회 — 최소 용도로만)
  getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      this.adminClient = createClient(this.url, this.serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    return this.adminClient;
  }

  // Private 버킷 대응: 세션 레코드의 raw 경로를 단기 서명된 URL로 일괄 교체
  async addSignedUrlsToSessions(sessions: any[], userId?: string): Promise<any[]> {
    const BUCKET = 'photo-results';
    const TTL = 3600;

    const pathSet = new Set<string>();
    for (const s of sessions) {
      if (s.result_thumbnail_path) pathSet.add(s.result_thumbnail_path);
      if (s.result_image_path) pathSet.add(s.result_image_path);
      for (const p of (s.photos ?? [])) {
        if (p.processed_path) pathSet.add(p.processed_path);
        if (p.original_path) pathSet.add(p.original_path);
      }
    }

    if (pathSet.size === 0) {
      return sessions.map((s) => this.stripRawPaths(s));
    }

    const allowedPaths = userId
      ? [...pathSet].filter((path) => path.startsWith(`${userId}/`))
      : [...pathSet];

    if (allowedPaths.length === 0) {
      return sessions.map((s) => this.stripRawPaths(s));
    }

    const { data: signed } = await this.getAdminClient()
      .storage
      .from(BUCKET)
      .createSignedUrls(allowedPaths, TTL);

    const urlMap = new Map<string, string>();
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl);
    }

    return sessions.map((session) => {
      const { result_thumbnail_path, result_image_path, ...rest } = session;
      const photos = ((session.photos ?? []) as any[]).map((photo: any) => {
        const { original_path, processed_path, ...photoRest } = photo;
        return {
          ...photoRest,
          photo_url: urlMap.get(processed_path) ?? urlMap.get(original_path) ?? null,
        };
      });
      return {
        ...rest,
        photos,
        result_thumbnail_url: result_thumbnail_path ? (urlMap.get(result_thumbnail_path) ?? null) : null,
        result_image_url: result_image_path ? (urlMap.get(result_image_path) ?? null) : null,
      };
    });
  }

  // signed URL이 없어도 raw 경로가 응답에 나가지 않도록 정리
  private stripRawPaths(session: any) {
    const { result_thumbnail_path, result_image_path, ...rest } = session;
    const photos = ((session.photos ?? []) as any[]).map((photo: any) => {
      const { original_path, processed_path, ...photoRest } = photo;
      return { ...photoRest, photo_url: null };
    });
    return {
      ...rest,
      photos,
      result_thumbnail_url: null,
      result_image_url: null,
    };
  }

  // 앱 시작 시 photo-results 버킷을 Private으로 강제 설정
  async onModuleInit() {
    if (!this.serviceKey) {
      this.logger.warn('SUPABASE_SERVICE_KEY 미설정 — 버킷 private 설정을 건너뜁니다.');
      return;
    }
    const { error } = await this.getAdminClient()
      .storage
      .updateBucket('photo-results', { public: false });

    if (error) {
      this.logger.error(`photo-results 버킷 private 설정 실패: ${error.message}`);
    } else {
      this.logger.log('photo-results 버킷이 private으로 설정되었습니다.');
    }
  }
}
