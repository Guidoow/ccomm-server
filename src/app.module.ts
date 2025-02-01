import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { UtilsModule } from './utils/utils.module';
import { TokensModule } from './tokens/tokens.module';
import { ChannelsModule } from './channels/channels.module';

@Module({
  imports: [
    AuthModule,
    CacheModule,
    TokensModule,
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    ChannelsModule,
    UtilsModule,
  ],
})
export class AppModule {}
