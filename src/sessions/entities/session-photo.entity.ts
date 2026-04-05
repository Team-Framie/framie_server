export interface SessionPhoto {
  id: string;
  session_id: string;
  shot_order: number;
  original_path: string | null;
  processed_path: string | null;
  is_transparent_png: boolean;
  created_at: string;
}
