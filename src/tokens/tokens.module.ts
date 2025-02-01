import { Module } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { CacheModule } from 'src/cache/cache.module';
import { UtilsModule } from 'src/utils/utils.module';

@Module({
  imports: [UtilsModule, CacheModule],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}
