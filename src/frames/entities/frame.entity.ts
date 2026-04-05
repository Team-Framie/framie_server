export interface Frame {
  id: string;
  creator_id: string | null;
  title: string | null;
  message: string | null;
  frame_layout: string | null;
  original_frame_path: string | null;
  removed_bg_frame_path: string | null;
  thumbnail_path: string | null;
  is_public: boolean;
  shot_count: number;
  created_at: string;
  updated_at: string;
}
