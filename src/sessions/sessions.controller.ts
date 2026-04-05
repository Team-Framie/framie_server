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
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

@Controller('sessions')
@UseGuards(SupabaseAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateSessionDto) {
    return this.sessionsService.create(req.user.id, req.token, dto);
  }

  @Get()
  findAll(
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.sessionsService.findAllByUser(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.sessionsService.findOne(id, req.user.id);
  }
}
