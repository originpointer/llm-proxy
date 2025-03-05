import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { LLMService } from './llm.service';
import { DifyChatService } from './dify-chat.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [ChatController],
  providers: [ChatService, LLMService, DifyChatService],
})
export class ChatModule {}
