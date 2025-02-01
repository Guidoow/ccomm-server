import { Injectable } from '@nestjs/common';

type ExistsCallback = (param: string) => boolean | Promise<boolean>;

@Injectable()
export class UtilsService {
  private readonly CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  private readonly SYMBOLS = '.,_-#@$%.,_-#@$%.,_-#@$%.,_-#@$%.,_-#@$%';
  private readonly NUMBERS = '0123456789';

  async generateEndpoint(exists: ExistsCallback) {
    let EP = '';

    for (let i = 0; i < 7; i++) {
      const RI = Math.floor(Math.random() * this.CHARS.length);
      EP += this.CHARS[RI];
    }

    return (await exists(EP))
      ? this.generateEndpoint(exists)
      : `${EP.slice(0, 1)}.${EP.slice(1, 4)}.${EP.slice(4, 8)}`;
  }

  async generateID(exists: ExistsCallback) {
    let ID = '';

    const chars = this.CHARS + this.SYMBOLS + this.NUMBERS;

    for (let i = 0; i < 32; i++) {
      const RI = Math.floor(Math.random() * chars.length);
      ID += chars[RI];
    }

    return (await exists(ID)) ? this.generateID(exists) : ID;
  }

  async generateChannelName(
    startpoint: string,
    endpoint: string,
    exists: ExistsCallback,
  ) {
    const len = 18;
    const chars = this.CHARS + this.NUMBERS;
    let name = '';

    for (let i = 0; i < len; i++) {
      const RI = Math.floor(Math.random() * chars.length);
      name += chars[RI];
    }

    name =
      'CHANNEL:' + [...name.match(/.{6}/g), startpoint, endpoint].join('.');

    console.log('channelName:', name);

    return (await exists(name))
      ? this.generateChannelName(startpoint, endpoint, exists)
      : name;
  }

  cleanIP(ip: string) {
    return ip.split(':').at(-1);
  }
}
