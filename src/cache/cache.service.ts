import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { env } from 'process';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private redisClient: RedisClientType<any, any>;
  private connected: boolean = false;
  private reconnectTimeout: NodeJS.Timeout;
  private preventDisconnect: boolean = true;

  constructor() {
    this.redisClient = createClient({
      socket: {
        host: env.DATABASE_HOST,
        port: Number(env.DATABASE_PORT),
      },
      password: env.DATABASE_PASSWORD,
    });

    this.connect();

    this.redisClient.on('error', async (err) => {
      if (this.reconnectTimeout || !this.preventDisconnect) return;

      const date = String(new Date()).split(' ').slice(0, 5);
      console.info(`[${date}][REDIS] Error in the client: ${err}.`);

      if (this.connected) await this.redisClient.disconnect();

      this.reconnectTimeout = setTimeout(async () => {
        const date = String(new Date()).split(' ').slice(0, 5);
        console.info(`[${date}][REDIS] Reconnecting.`);
        await this.connect();

        clearTimeout(this.reconnectTimeout);
      }, 15_000);
    });
  }

  async onModuleDestroy() {
    if (this.redisClient && this.connected) {
      this.preventDisconnect = false;
      await this.redisClient.quit();
    }
  }

  async connect() {
    this.connected = await this.connectDatabase();
    const date = String(new Date()).split(' ').slice(0, 5);
    console.info(
      this.connected
        ? `[${date}][REDIS] CONNECTED.`
        : `[${date}][REDIS] FAILED.`,
    );
  }

  private async connectDatabase(): Promise<boolean> {
    try {
      if (this.redisClient.isOpen) await this.redisClient.disconnect();
      return await this.redisClient.connect().then((res) => res.isOpen);
    } catch {
      return false;
    }
  }

  get client() {
    return this.redisClient;
  }

  // async get(key: string): Promise<Array<any> | object | undefined> {
  //   const result = await this.redisClient.get(key);
  //   return result ? JSON.parse(result) : undefined;
  // }

  // async set(key: string, value: string): Promise<boolean> {
  //   return (await this.redisClient.set(key, value)) === 'OK';
  // }

  // async del(key: string): Promise<boolean> {
  //   return Boolean(await this.redisClient.del(key));
  // }
}
