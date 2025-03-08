import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { Response } from "express";
import { MessageDto, VoiceNetQueryDto } from "./dto/voice-net-query.dto";
import { get } from "lodash";
import { DifyQueryDto } from "./dto/dify-query.dto";
import { DifyChatService } from "./dify-chat.service";
import { firstValueFrom } from "rxjs";
import { SharedDataService } from "./shared-data.service";

@Injectable()
export class VoiceNetService {
    private readonly logger = new Logger(VoiceNetService.name);

    constructor(
        private readonly difyChatService: DifyChatService,
        private readonly sharedDataService: SharedDataService
    ) {}

    async convertDifyCompletionQuery(voiceNetQuery: VoiceNetQueryDto, apiKey: string) {
        if (!apiKey) {
            throw new UnauthorizedException('API key is required');
        }

        const difyQuery = await this.voiceNetQueryToDifyQuery(voiceNetQuery);
        

        return difyQuery;
    }

    /**
     * 根据 userId 获取 conversationId
     * @param userId 
     * @returns 
     */
    getConversationIdByUserId(userId: string): string {
        return this.sharedDataService.getConversationId(userId);
    }

    /**
     * 设置 userId 对应的 conversationId
     * @param userId 
     * @param conversationId 
     * @returns 
     */
    setConversationIdByUserId(userId: string, conversationId: string): string {
        this.sharedDataService.setConversationId(userId, conversationId);
        return conversationId;
    }

    /**
     * 将 voiceNetQuery 转换为 difyQuery
     * @param voiceNetQuery 
     * @returns 
     */
    async voiceNetQueryToDifyQuery(voiceNetQuery: VoiceNetQueryDto) {
        const messages: MessageDto[] = get(voiceNetQuery, 'messages', []);
        const stream = get(voiceNetQuery, 'stream', false);
        const streamOptions = get(voiceNetQuery, 'stream_options', {});
        const maxTokens = get(voiceNetQuery, 'maxTokens', 1024);
        const model = get(voiceNetQuery, 'model', 'dify');

        /**
         * 当前 model 暂无作用，而且是声网渠道目前可修改的唯一变量，
         * 所以暂时将 model 作为 userId 使用
         */
        const userId = model;
        
        const userMessages = messages.filter(message => message.role === 'user' && Boolean(message.content));

        if (userMessages.length <= 1) {
            this.sharedDataService.setConversationId(userId, '');
        }

        const conversationId = this.sharedDataService.getConversationId(userId);
        
        const lastUserMessage = userMessages[userMessages.length - 1];

        const difyQuery = new DifyQueryDto();
        if (lastUserMessage.content) {
            difyQuery.query = lastUserMessage.content;
        }
        difyQuery.user = userId;
        difyQuery.response_mode = stream ? 'streaming' : 'blocking';
        difyQuery.max_tokens = maxTokens;
        difyQuery.conversation_id = conversationId;
        difyQuery.inputs = {};

        return difyQuery;
    }
}