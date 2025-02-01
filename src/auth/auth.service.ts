import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpResponse, Request, Token } from 'src/interfaces';
import { TokensService } from 'src/tokens/tokens.service';
import { BanService } from './ban.service';

interface Route {
  path: string;
}

@Injectable()
export class AuthService {
  constructor(
    private tokenService: TokensService,
    private banService: BanService,
  ) {}

  MAX_SESSIONS_ALLOWED = 20;
  MAX_TOKENS_PER_IP = 10;

  async getToken(request: Request): Promise<Token | null> {
    const ID = request.headers.authorization;

    const route = request.route as Route;
    const wantsNewToken = Boolean(
      request.method === 'GET' && route.path === '/auth',
    );

    if (ID || (ID && !wantsNewToken)) return await this.validate(request, ID);

    if (wantsNewToken) {
      await this.tokenService.removeExpired();
      const tokens = await this.tokenService.get();

      const filteredTokens = tokens.filter(
        (t) => t.IP === this.cleanIP(request),
      );

      if (filteredTokens.length >= this.MAX_TOKENS_PER_IP)
        throw new HttpException(
          'Max tokens reached per ip. Use a previous one, refresh a previous one or wait until one expires.',
          HttpStatus.BAD_REQUEST,
        );

      return null;
    }

    this.throwInvalidToken();
  }

  async createSession(request: Request): Promise<HttpResponse> {
    if (request.token && request.token.ID) {
      const clientIP = this.cleanIP(request);
      if (clientIP !== request.token.IP) {
        await this.banService.ban(clientIP);
        throw new HttpException(
          'Unauthorized access, permanent block.',
          HttpStatus.UNAUTHORIZED,
        );
      }
      await this.tokenService.del(request.token.ID);
      delete request.token;
    }

    const token = await this.tokenService.createToken(request);

    await this.tokenService.set(token);

    return {
      statusCode: HttpStatus.OK,
      data: {
        token: token.ID,
        endpoint: token.endpoint,
      },
    };
  }

  async removeSession(ID: string): Promise<boolean> {
    const deletedSession = await this.tokenService.del(ID);

    await this.tokenService.removeExpired();

    if (!deletedSession)
      throw new HttpException(
        'Server had an internal error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    return true;
  }

  sanitizeToken(tokenSupplied: string) {
    const allowedChars = /^[A-Za-z0-9\.\,\_\-\#\@\$\%]+$/;
    return tokenSupplied
      .split('')
      .filter((char) => allowedChars.test(char))
      .join('');
  }

  async validate(request: Request, ID: string): Promise<Token> {
    ID = this.sanitizeToken(ID);

    const exists = await this.tokenService.exists(ID);

    if (!exists) this.throwInvalidToken();

    const token = await this.tokenService.get(ID);

    const clientIP = this.cleanIP(request);

    if (clientIP !== token.IP || (await this.banService.isBanned(clientIP)))
      throw new HttpException('Unauthorized access.', HttpStatus.UNAUTHORIZED);

    return token;
  }

  private throwInvalidToken() {
    throw new HttpException('Invalid token supplied.', HttpStatus.BAD_REQUEST);
  }

  private cleanIP(request: Request) {
    return request.ip.split(':').at(-1);
  }
}
