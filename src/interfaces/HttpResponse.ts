import { HttpStatus } from '@nestjs/common';

export interface HttpResponse {
  statusCode: HttpStatus;
  data: object | number | string;
}
