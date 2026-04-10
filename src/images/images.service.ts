/// <reference types="multer" />
import { Injectable, HttpException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../common/supabase/supabase.service';
import axios from 'axios';
import FormData from 'form-data';
import { fromBuffer } from 'file-type';
import sharp from 'sharp';

export const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_IMAGE_EXTS = new Set(['jpg', 'png', 'webp']);

@Injectable()
export class ImagesService {
  private readonly imageServerUrl: string;

  constructor(
    config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.imageServerUrl = config.get('IMAGE_SERVER_URL', 'http://localhost:8001');
  }

  // magic bytes 검증 + 감지된 실제 타입 반환
  private async validateImageFile(buffer: Buffer): Promise<{ ext: string; mime: string }> {
    const detected = await fromBuffer(buffer);
    if (!detected || !ALLOWED_IMAGE_EXTS.has(detected.ext)) {
      throw new BadRequestException('이미지 파일(JPEG, PNG, WebP)만 업로드할 수 있습니다.');
    }
    this.checkDecompressionBomb(buffer, detected.ext);
    return { ext: detected.ext, mime: detected.mime };
  }

  // EXIF/메타데이터 제거 후 안전한 버퍼 반환 (ImageMagick/Pillow exploit 방어)
  // sharp는 withMetadata() 미호출 시 기본으로 모든 메타데이터를 제거함
  private async sanitizeImage(buffer: Buffer, ext: string): Promise<Buffer> {
    const s = sharp(buffer);
    if (ext === 'png') return s.png().toBuffer();
    if (ext === 'webp') return s.webp().toBuffer();
    return s.jpeg().toBuffer();
  }

  // PNG/JPEG 압축 폭탄(Decompression Bomb) 방어
  private checkDecompressionBomb(buffer: Buffer, ext: string): void {
    const MAX_PIXELS = 50_000_000; // 50MP 초과 시 거부

    try {
      if (ext === 'png' && buffer.length >= 24) {
        // PNG IHDR: 시그니처(8) + 청크길이(4) + 청크타입(4) + 너비(4) + 높이(4)
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        if (width * height > MAX_PIXELS) {
          throw new BadRequestException('이미지 해상도가 허용 범위를 초과합니다. (최대 50MP)');
        }
      } else if (ext === 'jpg' && buffer.length > 10) {
        // JPEG SOF 마커 스캔으로 실제 해상도 확인
        let offset = 2; // SOI 마커 건너뜀
        while (offset < buffer.length - 4) {
          if (buffer[offset] !== 0xff) break;
          const marker = buffer[offset + 1];
          // SOF0~SOF3, SOF5~SOF7 마커에 해상도 포함
          if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            if (width * height > MAX_PIXELS) {
              throw new BadRequestException('이미지 해상도가 허용 범위를 초과합니다. (최대 50MP)');
            }
            return;
          }
          if (offset + 4 > buffer.length) break;
          offset += 2 + buffer.readUInt16BE(offset + 2);
        }
      }
      // WebP: 비트스트림 파싱 복잡 → 파일 크기 제한(10MB)으로 대응
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      // 파싱 오류는 무시 (magic bytes 검증은 이미 완료)
    }
  }

  async removeBackground(file: Express.Multer.File): Promise<Buffer> {
    const { ext, mime } = await this.validateImageFile(file.buffer);
    // EXIF 등 메타데이터 제거 후 이미지 서버로 전달 (폴리글랏 exploit 방어)
    const safeBuffer = await this.sanitizeImage(file.buffer, ext);

    try {
      const formData = new FormData();
      formData.append('image', safeBuffer, {
        filename: `upload.${ext}`,  // 클라이언트 originalname 대신 안전한 고정 파일명
        contentType: mime,           // 클라이언트 mimetype 대신 magic bytes 감지 결과 사용
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
        const status = error.response?.status ?? 502;
        throw new HttpException(
          status >= 500 ? '이미지 처리 서버 오류가 발생했습니다.' : '이미지 처리에 실패했습니다.',
          status,
        );
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
    const { ext, mime } = await this.validateImageFile(file.buffer);
    const safeBuffer = await this.sanitizeImage(file.buffer, ext);

    const client = this.supabase.getClientForUser(token);

    const { error } = await client.storage
      .from(bucket)
      .upload(filePath, safeBuffer, {
        contentType: mime,  // magic bytes 감지 결과 사용 (클라이언트 mimetype 불신)
        upsert: true,
      });

    if (error) {
      throw new HttpException('파일 업로드에 실패했습니다.', 500);  // 내부 에러 메시지 노출 차단
    }

    // Private 버킷이므로 공개 URL 대신 서명된 단기 URL 발급 (24시간)
    const { data: signedData, error: signErr } = await client.storage
      .from(bucket)
      .createSignedUrl(filePath, 24 * 3600);

    if (signErr || !signedData?.signedUrl) {
      throw new HttpException('업로드 URL 생성에 실패했습니다.', 500);
    }

    return {
      url: signedData.signedUrl,
      path: filePath,
    };
  }
}
