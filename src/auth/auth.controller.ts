import { Controller, Post, Get, Body, Headers, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 회원가입: 1분에 5회
  @Post('signup')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  // 로그인: 1분에 10회 (브루트포스 방지)
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  getMe(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '');
    return this.authService.getMe(token);
  }
}
