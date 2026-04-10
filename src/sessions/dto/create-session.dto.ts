import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SessionPhotoDto {
  @IsNumber()
  @Min(1)
  @Max(10)
  shot_order!: number;

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
  frame_id!: string;

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

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SessionPhotoDto)
  photos!: SessionPhotoDto[];
}
