import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class FramesService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(shotCount?: number, title?: string) {
    const client = this.supabase.getClient();
    let query = client.from('frames').select('*').order('created_at', { ascending: true });

    if (shotCount) {
      query = query.eq('shot_count', shotCount);
    }
    if (title) {
      query = query.eq('title', title);
    }

    const { data, error } = await query;
    if (error) throw new NotFoundException(error.message);

    return { frames: data };
  }

  async findOne(id: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('frames')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('프레임을 찾을 수 없습니다.');
    }
    return data;
  }
}
