import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { Request } from 'src/interfaces';

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  constructor(private readonly authService: AuthService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest() as Request;

    if (!request.ip)
      throw new HttpException(
        'Client IP is missing or invalid.',
        HttpStatus.BAD_REQUEST,
      );

    const token = await this.authService.getToken(request);

    request.token = token;

    return next.handle();
  }
}
