import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ShareService } from './share.service';

@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  // 공유 코드 열거 공격 방지: 1분에 20회로 제한
  @Get(':code')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  findByCode(@Param('code') code: string) {
    return this.shareService.findByCode(code);
  }
}
