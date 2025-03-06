import { Controller, Post, Body, Headers, UnauthorizedException, BadRequestException, Res } from '@nestjs/common';
import { ChatService } from './chat.service';
import { LLMQueryDto } from './dto/llm-query.dto';
import { LLMService } from './llm.service';
import { DifyChatService } from './dify-chat.service';
import { Response } from 'express';
import _, { get } from 'lodash';

@Controller('v1/chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly llmService: LLMService,
    private readonly difyChatService: DifyChatService
  ) {}

  @Post('completions')
  async completion(
    @Body() body: LLMQueryDto, 
    @Headers('authorization') authorization: string,
    @Res() response: Response
  ) {
    // 检查是否提供了授权头
    if (!authorization) {
      throw new UnauthorizedException('缺少授权信息');
    }
    
    // 处理授权信息，例如验证token
    // 通常authorization格式为: "Bearer your-token-here"
    const token = authorization.replace('Bearer ', '').trim();
    console.log('token:', token);
    
    // 转换DTO
    const difyQuery = this.llmService.transformLLMToDifyQuery(body, 'default-user');
    // console.log('difyQuery:', difyQuery);
    
    // 验证转换后的数据是否有效
    const validation = this.llmService.validateDifyQuery(difyQuery);
    if (!validation.isValid) {
      throw new BadRequestException(`请求数据验证失败: ${validation.errors?.join(', ')}`);
    }

    const responseMode = get(difyQuery, 'response_mode', 'streaming');
    
    // 判断是否为流式响应
    if (responseMode === 'streaming') {
      // 使用SSE方式返回响应
      await this.difyChatService.chatMessages(difyQuery, response, token);
    } else if (responseMode === 'blocking') {
      // 对于非流式响应，可以采用普通JSON方式返回
      console.log(`发起阻塞式请求`, difyQuery);
      const llmResponse = await this.difyChatService.blockingChatMessages(difyQuery, token);
      response.json(llmResponse);
    }
  }
}
