import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SessionPhotoDto {
  @IsNumber()
  shot_order: number;

  @IsString()
  @IsOptional()
  original_path?: string;

  @IsString()
  @IsOptional()
  processed_path?: string;

  @IsBoolean()
  @IsOptional()
  is_transparent_png?: boolean;
}

export class CreateSessionDto {
  @IsString()
  frame_id: string;

  @IsString()
  @IsOptional()
  frame_owner_id?: string;

  @IsString()
  @IsOptional()
  source_type?: string;

  @IsString()
  @IsOptional()
  user_message?: string;

  @IsString()
  @IsOptional()
  result_image_path?: string;

  @IsString()
  @IsOptional()
  result_thumbnail_path?: string;

  @IsBoolean()
  @IsOptional()
  is_saved?: boolean;

  @IsString()
  @IsOptional()
  display_user_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionPhotoDto)
  photos: SessionPhotoDto[];
}
