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
    return this.usersService.getRecentSessions(
      req.user.id,
      req.token,
      limit ? parseInt(limit, 10) : 10,
    );
  }
}
