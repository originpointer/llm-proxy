import { Injectable, Logger } from '@nestjs/common';
import { DifyQueryDto } from './dto/dify-query.dto';
import { Observable } from 'rxjs';
import axios from 'axios';
import { Response } from 'express';
import { convertToOpenAIFormat } from './utils/data-transform';

@Injectable()
export class DifyChatService {
    private readonly logger = new Logger(DifyChatService.name);
    private readonly difyApiUrl = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
    private readonly difyApiKey = process.env.DIFY_API_KEY || '';

    /**
     * 向Dify发送聊天请求，并以SSE方式返回响应
     * @param difyQuery Dify查询参数
     * @param response Express Response对象，用于设置SSE响应
     * @param apiKey 可选的API密钥，如果不提供则使用环境变量中的密钥
     */
    async chatMessages(difyQuery: DifyQueryDto, response: Response, apiKey?: string): Promise<void> {
        const usedApiKey = apiKey || this.difyApiKey;
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

        try {
            // 设置SSE响应头
            response.setHeader('Content-Type', 'text/event-stream');
            response.setHeader('Cache-Control', 'no-cache');
            response.setHeader('Connection', 'keep-alive');
            response.flushHeaders();
            const data = difyQuery;

            // const data = {
            //     "inputs": {},
            //     "query": "What are the specs of the iPhone 13 Pro Max?",
            //     "response_mode": "streaming",
            //     "conversation_id": "",
            //     "user": "abc-123",
            //     "files": [
            //         {
            //             "type": "image",
            //             "transfer_method": "remote_url",
            //             "url": "https://cloud.dify.ai/logo/logo-site.png"
            //         }
            //     ]
            // }

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

                        // 保存会话id
                        if (data.conversation_id && data.conversation_id !== newConversationId) {
                            newConversationId = data.conversation_id;
                        }

                        const openAIFormatted = convertToOpenAIFormat(data);

                        if (openAIFormatted) {
                            const openaiData = `data: ${JSON.stringify(openAIFormatted)}\n\n`;
                            this.logger.log(`openaiData ${openaiData}`);
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
                response.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
                response.end();
            });
        } catch (error) {
            // 处理请求错误
            this.logger.error(`向Dify发送请求时出错: ${error.message}`);

            // 如果响应头尚未发送，则返回JSON错误
            if (!response.headersSent) {
                response.status(500).json({ error: error.message });
            } else {
                // 如果已经开始SSE响应，则发送错误事件
                response.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
                response.end();
            }
        }
    }
}
