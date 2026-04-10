import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

@Controller('users/me')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('stats')
  getStats(@Req() req) {
    return this.usersService.getStats(req.user.id, req.token);
  }

  @Get('sessions')
  getRecentSessions(
    @Req() req,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : 10;
    const safeLimit = Number.isNaN(parsed) ? 10 : Math.min(Math.max(parsed, 1), 50);
    return this.usersService.getRecentSessions(req.user.id, req.token, safeLimit);
  }
}
