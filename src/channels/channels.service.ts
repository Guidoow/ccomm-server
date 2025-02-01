import {
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { env } from 'process';

import * as Ably from 'ably';

import { Channel, Request } from 'src/interfaces';
import { CacheService } from 'src/cache/cache.service';
import { UtilsService } from 'src/utils/utils.service';
import { TokensService } from 'src/tokens/tokens.service';

@Injectable()
export class ChannelsService implements OnModuleDestroy {
  private ably: Ably.Realtime;
  private ABLY_TOKEN_MAX_TIME = 1000 * 60 * 60 * 24;

  constructor(
    private readonly utilsService: UtilsService,
    private readonly cacheService: CacheService,
    private readonly tokenService: TokensService,
  ) {
    this.ably = new Ably.Realtime({
      key: env.ABLY_KEY,
      clientId: env.ABLY_UUID,
    });

    [
      'connected',
      'closing',
      'failed',
      'disconnected',
      'suspended',
      'closed',
    ].forEach((state) => {
      this.ably.connection.on(state as Ably.ConnectionEvent, () => {
        const date = String(new Date()).split(' ').slice(0, 5).join(' ');

        console.info(`[${date}][Ably] ${state}.`);
      });
    });
  }

  async onModuleDestroy() {
    if (this.ably) this.ably.connection.close();
  }

  private isChannel(obj: object): obj is Channel {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      'from' in obj &&
      'to' in obj &&
      'token' in obj &&
      'channel' in obj
    );
  }

  private async get(): Promise<Array<Channel>>;
  private async get(
    query?: { endpoint: string } | { channel: string },
  ): Promise<Channel | null>;
  private async get(
    query?: { endpoint: string } | { channel: string },
  ): Promise<Array<Channel> | Channel | null> {
    if (query && 'endpoint' in query) {
      const channel = await this.exists({ endpoint: query.endpoint });

      if (!channel) return null;

      if (!this.isChannel(channel))
        throw new HttpException(
          'Fatal server error.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );

      return channel;
    }

    if (query && 'channel' in query) {
      const exists = await this.exists({ channel: query.channel });

      if (!exists) return null;

      const channel = await this.cacheService.client.hGetAll(query.channel);

      if (!this.isChannel(channel))
        throw new HttpException(
          'Fatal server error.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );

      return channel;
    }

    const CHANNELs = await this.cacheService.client.KEYS('CHANNEL:*');

    const executor = this.cacheService.client.multi();
    CHANNELs.forEach((channel) => executor.HGETALL(channel));
    const channels = await executor.exec();

    return channels.reduce((acc, channel) => {
      if (typeof channel === 'object' && this.isChannel(channel))
        acc.push(channel);

      return acc;
    }, [] as Channel[]);
  }

  private async set(
    query:
      | { channel: Channel }
      | { token: string; channel: string }
      | { tokenTo: string; channel: string },
  ): Promise<boolean> {
    if ('token' in query && 'channel' in query) {
      await this.cacheService.client.HDEL(query.channel, 'token');

      return Boolean(
        await this.cacheService.client.HSET(query.channel, {
          token: query.token,
        }),
      );
    }

    if ('tokenTo' in query && 'channel' in query) {
      await this.cacheService.client.HDEL(query.channel, 'tokenTo');

      return Boolean(
        await this.cacheService.client.HSET(query.channel, {
          tokenTo: query.tokenTo,
        }),
      );
    }

    if ('channel' in query && typeof query.channel === 'object') {
      const entries = Object.fromEntries(
        Object.entries(query.channel).map(([k, v]) => [k, String(v)]),
      );

      return Boolean(
        await this.cacheService.client.HSET(query.channel.channel, entries),
      );
    }
  }

  private async del(channel: string) {
    return (await this.exists({ channel }))
      ? Boolean(await this.cacheService.client.DEL(channel))
      : true;
  }

  async isEndpointValid(endpoint: string) {
    const reg = /^[a-zA-Z]\.[a-zA-Z]{3}\.[a-zA-Z]{3}$/;

    const isValid = endpoint.length === 9 && reg.test(endpoint);

    if (!isValid) return false;

    return await this.existsEndpoint(endpoint);
  }

  async getChannel(request: Request, endpoint: string) {
    if (!(await this.isEndpointValid(endpoint)))
      throw new HttpException('Invalid endpoint.', HttpStatus.BAD_REQUEST);

    const prevChannelCLI = await this.get({ endpoint: request.token.endpoint });

    if (prevChannelCLI)
      if (prevChannelCLI.to !== endpoint)
        await this.del(prevChannelCLI.channel);
      else
        return {
          statusCode: HttpStatus.OK,
          data: {
            token: prevChannelCLI.token,
            endpoint: prevChannelCLI.to,
            channel: prevChannelCLI.channel,
          },
        };

    const prevChannelEND = await this.exists({ endpoint });
    const isPrevChannelENDtoCLI =
      prevChannelEND && prevChannelEND.to === request.token.endpoint;

    if (isPrevChannelENDtoCLI) {
      if (!prevChannelEND.tokenTo) {
        const token = await this.generateToken(
          request.token.endpoint,
          prevChannelEND.channel,
        );

        const set = await this.set({
          tokenTo: token,
          channel: prevChannelEND.channel,
        });

        if (!set)
          throw new HttpException(
            'Internal error.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );

        prevChannelEND.tokenTo = token;
      }

      return {
        statusCode: HttpStatus.OK,
        data: {
          token: prevChannelEND.tokenTo,
          endpoint: prevChannelEND.from,
          channel: prevChannelEND.channel,
        },
      };
    }

    return await this.generateChannel(request, endpoint);
  }

  async disconnect(request: Request) {
    const currentChannel =
      (await this.exists({
        endpoint: request.token.endpoint,
      })) ||
      (await this.exists({
        endpointTo: request.token.endpoint,
      }));

    if (!currentChannel)
      throw new HttpException(
        'Channel was disconnected previously.',
        HttpStatus.OK,
      );

    const deleted = await this.del(currentChannel.channel);

    if (!deleted)
      throw new HttpException(
        'Server ran into an internal error and could not delete the channel. ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    return {
      statusCode: HttpStatus.OK,
      message: 'Channel was successfully disconnected.',
    };
  }

  async refreshToken(request: Request) {
    const currentChannel =
      (await this.exists({
        endpoint: request.token.endpoint,
      })) ||
      (await this.exists({
        endpointTo: request.token.endpoint,
      }));

    if (!currentChannel)
      throw new HttpException(
        'You must create a channel connection first.',
        HttpStatus.PRECONDITION_FAILED,
      );

    const freshToken = await this.generateToken(
      request.token.endpoint,
      currentChannel.channel,
    );

    const isCreator = currentChannel.from === request.token.endpoint;

    if (isCreator) currentChannel.token = freshToken;
    else currentChannel.tokenTo = freshToken;

    const set = isCreator
      ? await this.set({ token: freshToken, channel: currentChannel.channel })
      : await this.set({
          tokenTo: freshToken,
          channel: currentChannel.channel,
        });

    if (!set)
      throw new HttpException(
        'Server failed internally, try again.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    if (isCreator)
      return {
        statusCode: HttpStatus.OK,
        data: {
          token: currentChannel.token,
          endpoint: currentChannel.to,
          channel: currentChannel.channel,
        },
      };
    else
      return {
        statusCode: HttpStatus.OK,
        data: {
          token: currentChannel.tokenTo,
          endpoint: currentChannel.from,
          channel: currentChannel.channel,
        },
      };
  }

  private async generateChannel(request: Request, endpoint: string) {
    // persists the context
    const exists = async (channel: string) => await this.exists({ channel });

    const channelName = await this.utilsService.generateChannelName(
      request.token.endpoint,
      endpoint,
      exists,
    );

    const token = await this.generateToken(request.token.endpoint, channelName);

    const channel: Channel = {
      from: request.token.endpoint,
      to: endpoint,
      channel: channelName,
      token,
    };

    const set = await this.set({ channel });

    if (!set)
      throw new HttpException(
        'Internal error.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    return {
      statusCode: HttpStatus.OK,
      data: {
        token: channel.token,
        endpoint: channel.to,
        channel: channelName,
      },
    };
  }

  private async generateToken(clientId: string, channel: string) {
    try {
      return JSON.stringify(
        await this.ably.auth.requestToken({
          clientId,
          capability: {
            [channel]: ['publish', 'subscribe', 'presence'],
          },
          ttl: this.ABLY_TOKEN_MAX_TIME,
        }),
      );
    } catch {
      return null;
    }
  }

  async existsEndpoint(endpoint: string): Promise<boolean> {
    const tokens = await this.tokenService.get();

    return Boolean(tokens.find((token) => token.endpoint === endpoint) || null);
  }

  async exists(query: { channel: string }): Promise<boolean>;
  async exists(query: { endpoint: string }): Promise<Channel | null>;
  async exists(query: { endpointTo: string }): Promise<Channel | null>;
  async exists(
    query: { channel: string } | { endpoint: string } | { endpointTo: string },
  ): Promise<Channel | boolean> {
    if ('channel' in query)
      return Boolean(await this.cacheService.client.EXISTS(query.channel));

    if ('endpoint' in query || 'endpointTo' in query) {
      const channels = await this.get();

      if (!channels) return null;

      if ('endpoint' in query)
        return channels.find((c) => c.from === query.endpoint) || null;
      else return channels.find((c) => c.to === query.endpointTo) || null;
    }

    return null;
  }
}
