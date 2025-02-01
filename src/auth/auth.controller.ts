import { Controller, Get, Req, UseInterceptors } from '@nestjs/common';
import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { Request } from 'src/interfaces';

@UseInterceptors(AuthInterceptor)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  async createSession(@Req() request: Request) {
    console.log('want to create session');
    return await this.authService.createSession(request);
  }
}
