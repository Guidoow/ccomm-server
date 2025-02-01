import { CacheService } from 'src/cache/cache.service';
import { Token } from 'src/interfaces';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'src/interfaces';
import { UtilsService } from 'src/utils/utils.service';

@Injectable()
export class TokensService {
  constructor(
    private cacheService: CacheService,
    private utilsService: UtilsService,
  ) {}

  isToken(obj: object): obj is Token {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      'IP' in obj &&
      'ID' in obj &&
      'expireDate' in obj
    );
  }

  async get(): Promise<Array<Token>>;
  async get(ID: string): Promise<Token>;
  async get(ID?: string): Promise<Array<Token> | Token> {
    if (ID) {
      const exists = await this.exists(ID);

      if (!exists)
        throw new HttpException(
          'Invalid token supplied.',
          HttpStatus.BAD_REQUEST,
        );

      const token = await this.cacheService.client.HGETALL(`TOKEN:${ID}`);

      if (!this.isToken(token))
        throw new HttpException(
          'Fatal server error.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );

      return token;
    }

    const IDs = await this.cacheService.client.KEYS('TOKEN:*');

    const executor = this.cacheService.client.multi();
    IDs.forEach((id) => executor.HGETALL(id));
    const tokens = await executor.exec();

    return tokens.map((t) => {
      if (typeof t === 'object' && this.isToken(t)) return t;
    }) as Token[];
  }

  async set(token: Token): Promise<boolean> {
    const entries = Object.fromEntries(
      Object.entries(token).map(([k, v]) => [k, String(v)]),
    );

    return Boolean(
      await this.cacheService.client.HSET(`TOKEN:${token.ID}`, entries),
    );
  }

  async del(ID: string): Promise<boolean> {
    const exists = await this.exists(ID);

    return exists
      ? Boolean(await this.cacheService.client.DEL(`TOKEN:${ID}`))
      : true;
  }

  async exists(ID: string): Promise<boolean> {
    const exists = await this.cacheService.client.EXISTS(`TOKEN:${ID}`);

    return Boolean(exists);
  }

  private async existsID(ID: string): Promise<boolean> {
    return ID === 'f';
  }

  private async existsEP(EP: string): Promise<boolean> {
    return EP === 'f';
  }

  async createToken(request: Request): Promise<Token> {
    const expiresIn = 1000 * 60 * 60 * 24;
    const expireDate = new Date(new Date().getTime() + expiresIn);

    const existsID = async (ID: string) => await this.existsID(ID);
    const existsEP = async (EP: string) => await this.existsEP(EP);

    return {
      expireDate,
      IP: this.utilsService.cleanIP(request.ip),
      ID: await this.utilsService.generateID(existsID),
      endpoint: await this.utilsService.generateEndpoint(existsEP),
    };
  }

  async removeExpired() {
    const tokens = await this.get();

    const date = new Date();
    for (const token of tokens) {
      const tokenExpired = date > new Date(token.expireDate);

      if (tokenExpired) this.del(token.ID);
    }
  }
}
