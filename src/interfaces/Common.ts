import { HttpStatus } from '@nestjs/common';

import { Request as ExpressRequest } from 'express';
import { Token } from './Cache';

export interface Response {
  statusCode: HttpStatus;
  message: string;
  error?: string;
}

export interface Request extends ExpressRequest {
  token: Token;
}
