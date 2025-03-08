import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { LLMService } from './llm.service';
import { DifyChatService } from './dify-chat.service';
import { HttpModule } from '@nestjs/axios';
import { VoiceNetService } from './voice-net.service';
import { SharedDataService } from './shared-data.service';
import { ConversationService } from './conversation.service';

@Module({
  imports: [HttpModule],
  controllers: [ChatController],
  providers: [
    ChatService, 
    LLMService, 
    DifyChatService, 
    VoiceNetService, 
    SharedDataService,
    ConversationService
  ],
})
export class ChatModule {}
