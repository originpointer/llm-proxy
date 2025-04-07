import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { AudioModule } from './audio/audio.module';
import configuration from './config/configuration';

@Module({
  imports: [ConfigModule.forRoot({
    load: [configuration],
    isGlobal: true,
  }), ChatModule, AudioModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
