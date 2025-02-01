import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CacheModule } from 'src/cache/cache.module';
import { TokensModule } from 'src/tokens/tokens.module';
import { AuthInterceptor } from './auth.interceptor';
import { BanService } from './ban.service';

@Module({
  imports: [CacheModule, TokensModule],
  controllers: [AuthController],
  providers: [AuthService, BanService, AuthInterceptor],
  exports: [AuthService, AuthInterceptor],
})
export class AuthModule {}
