import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { AuthInterceptor } from 'src/auth/auth.interceptor';
import { ChannelsService } from './channels.service';
import { Request } from 'src/interfaces';

@UseInterceptors(AuthInterceptor)
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get('disconnect')
  async disconnect(@Req() request: Request) {
    return await this.channelsService.disconnect(request);
  }

  @Get('/:endpoint')
  async listener(@Req() request: Request, @Param('endpoint') endpoint: string) {
    return await this.channelsService.getChannel(request, endpoint);
  }

  @Post('refresh')
  async refresh(@Req() request: Request) {
    return await this.channelsService.refreshToken(request);
  }
}
