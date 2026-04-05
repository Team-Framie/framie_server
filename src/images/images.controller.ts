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
import { Response, Request } from 'express';
import { ImagesService } from './images.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('remove-bg')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 10 * 1024 * 1024 } }))
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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
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
