import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard, CurrentUser, AuthUser } from './guards';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }, @Req() req: Request) {
    return this.authService.login(body.username || '', body.password || '', req.ip);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(user.id, body.currentPassword, body.newPassword);
  }
}
