import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CacheService } from 'src/cache/cache.service';

interface Ban {
  expireDate: Date;
  IP: string;
}

@Injectable()
export class BanService {
  constructor(private cacheService: CacheService) {}

  async ban(IP: string): Promise<boolean> {
    const expiresIn = 1000 * 60 * 60 * 24 * 30; // 1 month
    const expireDate = new Date(new Date().getTime() + expiresIn);

    const ban: Ban = {
      IP,
      expireDate,
    };

    return await this.set(ban);
  }

  async isBanned(IP: string) {
    const exists = await this.cacheService.client.EXISTS(`BAN:${IP}`);

    return Boolean(exists);
  }

  async get(): Promise<Array<Ban>>;
  async get(IP: string): Promise<Ban>;
  async get(IP?: string): Promise<Array<Ban> | Ban> {
    await this.removeExpired();

    if (IP) {
      const exists = await this.isBanned(IP);

      if (!exists)
        throw new HttpException('Invalid IP supplied.', HttpStatus.BAD_REQUEST);

      const ban = await this.cacheService.client.HGETALL(`BAN:${IP}`);

      if (!this.isBan(ban))
        throw new HttpException(
          'Fatal server error.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );

      return ban;
    }

    const IPs = await this.cacheService.client.KEYS('BAN:*');

    const executor = this.cacheService.client.multi();
    IPs.forEach((ip) => executor.HGETALL(ip));
    const BANs = await executor.exec();

    return BANs.map((t) => {
      if (typeof t === 'object' && this.isBan(t)) return t;
    }) as Ban[];
  }

  private isBan(obj: object): obj is Ban {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      'IP' in obj &&
      'expireDate' in obj
    );
  }

  private async set(ban: Ban) {
    const entries = Object.fromEntries(
      Object.entries(ban).map(([k, v]) => [k, String(v)]),
    );

    return Boolean(
      await this.cacheService.client.HSET(`BAN:${ban.IP}`, entries),
    );
  }

  private async del(IP: string) {
    const exists = await this.isBanned(IP);

    return exists
      ? Boolean(await this.cacheService.client.DEL(`TOKEN:${IP}`))
      : true;
  }

  private async removeExpired() {
    const BANs = await this.get();

    const date = new Date();
    for (const ban of BANs) {
      const banExpired = date > new Date(ban.expireDate);

      if (banExpired) this.del(ban.IP);
    }
  }
}
