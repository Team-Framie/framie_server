import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;
  private readonly url: string;
  private readonly anonKey: string;

  constructor(config: ConfigService) {
    this.url = config.get<string>('SUPABASE_URL', '');
    this.anonKey = config.get<string>('SUPABASE_ANON_KEY', '');
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
}
