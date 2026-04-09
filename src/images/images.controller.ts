import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { Response, Request } from 'express';
import { ImagesService, ALLOWED_IMAGE_MIMES } from './images.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

const imageFileFilter: MulterOptions['fileFilter'] = (_req, file, cb) => {
  const allowed = ALLOWED_IMAGE_MIMES.has(file.mimetype);
  cb(allowed ? null : new Error('이미지 파일(JPEG, PNG, WebP)만 업로드할 수 있습니다.'), allowed);
};

const IMAGE_UPLOAD_OPTIONS: MulterOptions = {
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter,
};

@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('remove-bg')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(FileInterceptor('image', IMAGE_UPLOAD_OPTIONS))
  async removeBackground(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    const result = await this.imagesService.removeBackground(file);
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': 'inline; filename=removed_bg.png',
    });
    res.send(result);
  }

  @Post('upload')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(FileInterceptor('file', IMAGE_UPLOAD_OPTIONS))
  async upload(
    @Req() req: Request & { token: string },
    @UploadedFile() file: Express.Multer.File,
    @Body('bucket') bucket: string,
    @Body('path') filePath: string,
  ) {
    return this.imagesService.uploadFile(
      file,
      bucket || 'photo-results',
      filePath,
      req.token,
    );
  }
}
