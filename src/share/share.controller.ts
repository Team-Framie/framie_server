import { Controller, Get, Param } from '@nestjs/common';
import { ShareService } from './share.service';

@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get(':code')
  findByCode(@Param('code') code: string) {
    return this.shareService.findByCode(code);
  }
}
