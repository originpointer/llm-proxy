import { Injectable, Logger } from '@nestjs/common';
import { DifyQueryDto } from './dto/dify-query.dto';
import { Observable, from, fromEvent, throwError, of, merge } from 'rxjs';
import { map, mergeMap, takeUntil, catchError, tap, finalize } from 'rxjs/operators';
import axios from 'axios';
import { Response } from 'express';
import { convertBlockingToOpenAiFormat, convertToOpenAIFormat } from './utils/data-transform';
import { get } from 'lodash';
import { LLMQueryDto, MessageDto } from './dto/llm-query.dto';
import { SharedDataService } from './shared-data.service';

@Injectable()
export class DifyChatService {
    private readonly logger = new Logger(DifyChatService.name);
    private readonly difyApiUrl = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
    
    constructor(private readonly sharedDataService: SharedDataService) {}

    /**
     * 保存会话 ID
     * @param userId 用户 ID
     * @param conversationId 会话 ID
     */
    private saveConversationId(userId: string, conversationId: string): void {
        if (userId && conversationId) {
            this.sharedDataService.setConversationId(userId, conversationId);
            this.logger.log(`保存会话 ID: ${userId} -> ${conversationId}`);
        }
    }

    /**
     * 获取会话 ID
     * @param userId 用户 ID
     * @returns 会话 ID
     */
    private getConversationId(userId: string): string {
        return this.sharedDataService.getConversationId(userId);
    }

    /**
     * 向Dify发送聊天请求，并以SSE方式返回响应
     * @param difyQuery Dify查询参数
     * @param response Express Response对象，用于设置SSE响应
     * @param apiKey 可选的API密钥，如果不提供则使用环境变量中的密钥
     */
    async chatMessages(difyQuery: DifyQueryDto, response: Response, apiKey?: string): Promise<void> {
        const usedApiKey = apiKey;
        const userId = difyQuery.user;
        this.logger.log(`dify used api key ${usedApiKey}`);
        this.logger.log(`dify query ${JSON.stringify(difyQuery)}`);

        if (!usedApiKey) {
            this.logger.error('未提供Dify API密钥');
            response.status(500).json({ error: '服务器配置错误: 缺少API密钥' });
            return;
        }

        // 准备请求头
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${usedApiKey}`
        };

        // 标记是否已经发送响应头
        let headersSent = false;

        try {
            const data = difyQuery;

            const dataStr = JSON.stringify(data);
            const requestUrl = `${this.difyApiUrl}/v1/chat-messages`;
            // 记录请求开始
            this.logger.log(`请求地址: ${requestUrl}`);
            this.logger.log(`向Dify发送请求: ${dataStr}`);
            this.logger.log(`向Dify发送请求头: ${JSON.stringify(headers)}`);



            // 使用axios发送请求，并直接流式传输响应
            const axiosResponse = await axios({
                method: 'post',
                url: requestUrl,
                data: dataStr,
                headers,
                responseType: 'stream'
            });

            const stream = axiosResponse.data;

            let buffer = '';
            let newConversationId = null;
            // 将Dify响应流直接传输到客户端
            stream.on('data', (chunk) => {
                // this.logger.log(`chunk ${chunk}`);
                buffer += chunk.toString();

                let lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (!line.startsWith('data:')) continue;

                    try {
                        const data = JSON.parse(line.slice(6));

                        // this.logger.log('[chat] data:', data);
                        const conversationId = get(data, 'conversation_id', '');
                        this.logger.log(`[chat] conversationId: ${conversationId}`);

                        if (conversationId) {
                            this.saveConversationId(userId, conversationId);
                        }

                        const openAIFormat = convertToOpenAIFormat(data);

                        if (openAIFormat) {
                            // 第一次收到数据时设置响应头
                            if (!headersSent) {
                                response.status(200);
                                response.setHeader('Content-Type', 'text/event-stream');
                                response.setHeader('Cache-Control', 'no-cache');
                                response.setHeader('Connection', 'keep-alive');
                                response.flushHeaders();
                                headersSent = true;
                            }
                            
                            const openaiData = `data: ${JSON.stringify(openAIFormat)}\n\n`;
                            // this.logger.log(`openaiData ${openaiData}`);
                            const openaiDataBuffer = Buffer.from(openaiData);
                            response.write(openaiDataBuffer);
                        }


                    } catch (e) {
                        this.logger.error(`处理流数据时出错: ${e.message}`);
                    }
                }
            });

            // 处理流结束事件
            axiosResponse.data.on('end', () => {
                this.logger.log('Dify SSE流结束');
                const endMessage = {
                    id: `chatcmpl-${Date.now()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: 'dify-proxy',
                    choices: [{
                        delta: {},
                        index: 0,
                        finish_reason: 'stop'
                    }],
                    stream_options: { include_usage: true },
                    usage: {
                        prompt_tokens: 1,  // 默认值，实际应从Dify响应中获取
                        completion_tokens: 2,  // 默认值，实际应从Dify响应中获取
                        total_tokens: 3  // 默认值，实际应从Dify响应中获取
                    }
                };

                response.write(Buffer.from(`data: ${JSON.stringify(endMessage)}\n\n`));
                response.write(Buffer.from('data: [DONE]\n\n'));
                response.end();
            });

            // 处理错误
            axiosResponse.data.on('error', (error) => {
                this.logger.error(`Dify请求流错误: ${error.message}`);
                if (headersSent) {
                    // 如果已经发送了响应头，使用 SSE 格式返回错误
                    response.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
                    response.end();
                } else {
                    // 否则返回 JSON 格式错误
                    response.status(500).json({ error: error.message });
                }
            });
        } catch (error) {
            // 处理请求错误
            this.logger.error(`向Dify发送请求时出错: ${error.message}`);

            // 如果响应头尚未发送，则返回JSON错误
            if (!headersSent) {
                response.status(500).json({ error: error.message });
            } else {
                // 如果已经开始SSE响应，则发送错误事件
                response.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
                response.end();
            }
        }
    }

    async blockingChatMessages(difyQuery: DifyQueryDto, apiKey?: string): Promise<any> {
        const usedApiKey = apiKey;

        if (!usedApiKey) {
            this.logger.error('未提供Dify API密钥');
            throw new Error('服务器配置错误: 缺少API密钥');
            // response.status(500).json({ error: '服务器配置错误: 缺少API密钥' });
            return;
        }

        // 准备请求头
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${usedApiKey}`
        };

        const requestUrl = `${this.difyApiUrl}/v1/chat-messages`;

        const difyQueryData = {
            method: 'post',
            url: requestUrl,
            data: {
                ...difyQuery,
            },
            headers,
        }

        const res = await axios(difyQueryData);

        const openAiFormat = convertBlockingToOpenAiFormat(res.data);
        // 添加原始响应状态码
        (openAiFormat as any)._statusCode = res.status;

        this.logger.log(`dify query ${JSON.stringify(res.data)}`);
        this.logger.log(`openAiFormat ${JSON.stringify(openAiFormat)}`);

        return openAiFormat;
        // this.logger.log(`dify query ${JSON.stringify(difyQuery)}`);

        // response.write(Buffer.from(JSON.stringify(openAiFormat)));
        // response.end();
    }

    /**
     * 使用 RxJS Observable 流式返回聊天消息
     * @param difyQuery Dify查询参数
     * @param userId 用户ID
     * @param apiKey 可选的API密钥，如果不提供则使用环境变量中的密钥
     * @returns Observable<any> 返回包含聊天消息的Observable流
     */
    rxChatMessages(difyQuery: DifyQueryDto, userId: string, apiKey?: string): Observable<any> {
        const usedApiKey = apiKey;
        this.logger.log(`dify query ${JSON.stringify(difyQuery)}`);

        if (!usedApiKey) {
            this.logger.error('未提供Dify API密钥');
            return throwError(() => new Error('服务器配置错误: 缺少API密钥'));
        }

        // 准备请求头
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${usedApiKey}`
        };

        const dataStr = JSON.stringify(difyQuery);
        const requestUrl = `${this.difyApiUrl}/v1/chat-messages`;
        
        // 记录请求开始
        this.logger.log(`请求地址: ${requestUrl}`);
        this.logger.log(`向Dify发送请求: ${dataStr}`);

        return from(axios({
            method: 'post',
            url: requestUrl,
            data: dataStr,
            headers,
            responseType: 'stream'
        })).pipe(
            mergeMap(axiosResponse => {
                const stream = axiosResponse.data;
                const statusCode = axiosResponse.status; // 获取 Dify 响应的原始状态码
                let buffer = '';
                let newConversationId = null;

                // 从流中创建数据事件的Observable
                const data$ = fromEvent(stream, 'data').pipe(
                    map((chunk: Buffer) => {
                        buffer += chunk.toString();
                        let lines = buffer.split('\n\n');
                        buffer = lines.pop() || '';
                        
                        return lines.map(line => {
                            if (line.trim() === '' || !line.startsWith('data:')) {
                                return null;
                            }
                            
                            try {
                                const data = JSON.parse(line.slice(6));
                                const conversationId = get(data, 'conversation_id', '');
                                this.logger.log(`[chat] conversationId: ${conversationId}`);
                                
                                // 保存会话 ID
                                if (conversationId) {
                                    this.saveConversationId(userId, conversationId);
                                }
                                
                                const openAIFormat = convertToOpenAIFormat(data);
                                // 添加原始响应状态码
                                if (openAIFormat) {
                                    (openAIFormat as any)._statusCode = statusCode;
                                }
                                return openAIFormat;
                            } catch (e) {
                                this.logger.error(`处理流数据时出错: ${e.message}`);
                                return null;
                            }
                        }).filter(item => item !== null);
                    }),
                    // 扁平化结果数组
                    mergeMap(items => items)
                );

                // 从流中创建结束事件的Observable
                const end$ = fromEvent(stream, 'end').pipe(
                    map(() => {
                        this.logger.log('Dify SSE流结束');
                        return {
                            id: `chatcmpl-${Date.now()}`,
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: 'dify-proxy',
                            choices: [{
                                delta: {},
                                index: 0,
                                finish_reason: 'stop'
                            }],
                            stream_options: { include_usage: true },
                            usage: {
                                prompt_tokens: 1,
                                completion_tokens: 2,
                                total_tokens: 3
                            },
                            _final: true,
                            _statusCode: statusCode // 添加原始响应状态码
                        };
                    })
                );

                // 从流中创建错误事件的Observable
                const error$ = fromEvent(stream, 'error').pipe(
                    mergeMap((error: any) => throwError(() => new Error(`Dify请求流错误: ${error.message}`)))
                );

                // 合并所有事件
                return merge(data$, end$).pipe(
                    takeUntil(error$)
                );
            }),
            catchError((error: any) => {
                this.logger.error(`向Dify发送请求时出错: ${error.message}`);
                return throwError(() => error);
            })
        );
    }

    /**
     * 将LLMQueryDto的数据格式转换为DifyQueryDto的数据格式
     * @param llmQuery LLM查询DTO
     * @param userId 用户ID，默认为'default-user'
     * @returns Dify查询DTO
     */
    transformLLMToDifyQuery(llmQuery: LLMQueryDto, userId: string = 'default-user'): DifyQueryDto {
        // 获取最后一条用户消息作为查询内容
        const lastUserMessage = get(llmQuery, 'messages', [])
            .slice()
            .reverse()
            .find(message => message.role === 'user');
        
        // 创建转换后的DifyQueryDto对象
        const difyQuery = new DifyQueryDto();
        
        // 设置必填字段
        difyQuery.query = lastUserMessage?.content || '';
        difyQuery.user = userId;
        
        // 设置response_mode(根据stream参数)
        difyQuery.response_mode = llmQuery.stream ? 'streaming' : 'blocking';
        
        // 转换可选参数
        if (llmQuery.temperature !== undefined) {
            difyQuery.temperature = llmQuery.temperature;
        }
        
        if (llmQuery.maxTokens !== undefined) {
            difyQuery.max_tokens = llmQuery.maxTokens;
        }
        
        if (llmQuery.model) {
            difyQuery.model = llmQuery.model;
        }
        
        if (llmQuery.top_p !== undefined) {
            difyQuery.top_p = llmQuery.top_p;
        }
        
        // 构建对话历史
        difyQuery.inputs = {
            conversation_history: llmQuery.messages
                .filter(message => message !== lastUserMessage) // 排除最后一条用户消息(已作为查询)
                .map(message => ({
                    role: message.role,
                    content: message.content || ''
                }))
        };
        
        // 默认没有文件
        difyQuery.files = [];
        
        return difyQuery;
    }

    /**
     * 验证转换后的DifyQueryDto是否有效
     * @param difyQuery Dify查询DTO
     * @returns 验证结果与错误信息
     */
    validateDifyQuery(difyQuery: DifyQueryDto): { isValid: boolean; errors?: string[] } {
        const errors: string[] = [];
        
        // 验证必要字段
        if (!difyQuery.query) {
            errors.push('查询内容不能为空');
        }
        
        if (!difyQuery.user) {
            errors.push('用户标识不能为空');
        }
        
        if (!difyQuery.response_mode) {
            errors.push('响应模式不能为空');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }
}
