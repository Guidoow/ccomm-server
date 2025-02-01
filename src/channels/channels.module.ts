import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { TokensModule } from 'src/tokens/tokens.module';
import { ChannelsService } from './channels.service';
import { UtilsModule } from 'src/utils/utils.module';
import { CacheModule } from 'src/cache/cache.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [UtilsModule, CacheModule, AuthModule, TokensModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
})
export class ChannelsModule {}
