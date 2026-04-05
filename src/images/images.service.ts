import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../common/supabase/supabase.service';
import axios from 'axios';
import FormData from 'form-data';

@Injectable()
export class ImagesService {
  private readonly imageServerUrl: string;

  constructor(
    config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.imageServerUrl = config.get('IMAGE_SERVER_URL', 'http://localhost:8001');
  }

  async removeBackground(file: Express.Multer.File): Promise<Buffer> {
    try {
      const formData = new FormData();
      formData.append('image', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const response = await axios.post(
        `${this.imageServerUrl}/remove-bg`,
        formData,
        {
          headers: formData.getHeaders(),
          responseType: 'arraybuffer',
          timeout: 30000,
        },
      );

      return Buffer.from(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 502;
        const message = error.response?.data
          ? Buffer.from(error.response.data).toString()
          : '이미지 서버 연결 실패';
        throw new HttpException(message, status);
      }
      throw new HttpException('배경 제거 처리 중 오류가 발생했습니다.', 500);
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    bucket: string,
    filePath: string,
    token: string,
  ): Promise<{ url: string; path: string }> {
    const client = this.supabase.getClientForUser(token);

    const { error } = await client.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw new HttpException(`업로드 실패: ${error.message}`, 500);
    }

    const { data: urlData } = client.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  }
}
