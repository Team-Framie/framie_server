import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

type AuthedRequest = Request & { user: { id: string }; token: string };

@Controller('sessions')
@UseGuards(SupabaseAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateSessionDto) {
    return this.sessionsService.create(req.user.id, req.token, dto);
  }

  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const safePage = Number.isNaN(parsedPage) ? 1 : Math.max(parsedPage, 1);
    const safeLimit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 100);
    return this.sessionsService.findAllByUser(req.user.id, req.token, safePage, safeLimit);
  }

  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.sessionsService.findOne(id, req.user.id, req.token);
  }
}
