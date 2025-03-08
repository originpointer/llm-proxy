import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
// import * as session from 'express-session';

import { AppModule } from './app.module';
import { DatabaseConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService<DatabaseConfig>>(ConfigService);
  const port = configService.get('port');
  // const sessionSecret = configService.get('session_secret');
  // app.use(
  //   session({
  //     secret: sessionSecret,
  //     resave: false,
  //     saveUninitialized: false,
  //     cookie: {
  //       maxAge: 1000 * 60 * 60 * 24 * 30, // 30天
  //     },
  //   })
  // );
  
  await app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

bootstrap();
