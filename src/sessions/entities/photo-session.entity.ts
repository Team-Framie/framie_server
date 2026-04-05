export interface PhotoSession {
  id: string;
  frame_id: string | null;
  photographer_id: string | null;
  frame_owner_id: string | null;
  source_type: string | null;
  user_message: string | null;
  result_image_path: string | null;
  result_thumbnail_path: string | null;
  is_saved: boolean;
  share_code_id: string | null;
  display_user_id: string | null;
  created_at: string;
}
