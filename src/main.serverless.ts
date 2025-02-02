import { ExpressAdapter } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import express from 'express';
import { env } from 'process';

const ENV_REQUIRED_VARIABLES = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_PASSWORD',
  'ABLY_KEY',
  'ABLY_UUID',
];

for (const var_name of ENV_REQUIRED_VARIABLES) {
  if (!Boolean(env[var_name]))
    throw new Error(
      `.ENV is not setted properly, required ${var_name} variable.`,
    );
}

const server = express();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.enableCors();
  await app.init();
}

bootstrap();

export default server;
