import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from 'process';

const ENV_REQUIRED_VARIABLES = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_PASSWORD',
  'ABLY_KEY',
  'ABLY_UUID',
];

for (const var_name in ENV_REQUIRED_VARIABLES) {
  if (!Boolean(env[var_name]))
    throw new Error(
      `.ENV is not setted properly, required ${var_name} variable.`,
    );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap();
