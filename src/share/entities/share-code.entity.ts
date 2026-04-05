export interface ShareCode {
  id: string;
  session_id: string | null;
  code: string;
  created_by: string | null;
  created_at: string;
}
