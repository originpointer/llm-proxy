import { Controller, Post, Body, Headers, UnauthorizedException, BadRequestException, Res, Session } from '@nestjs/common';
import { Response } from 'express';
import { LLMQueryDto } from './dto/llm-query.dto';
import { LLMService } from './llm.service';
import { DifyChatService } from './dify-chat.service';
import { get } from 'lodash';
import { VoiceNetQueryDto } from './dto/voice-net-query.dto';
import { VoiceNetService } from './voice-net.service';
import { Logger } from '@nestjs/common';
import { DifyQueryDto } from './dto/dify-query.dto';

@Controller('v1/chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly difyChatService: DifyChatService,
    private readonly voiceNetService: VoiceNetService
  ) {}

  @Post('voice-net-completions')
  async voiceNetCompletion(
    @Body() body: VoiceNetQueryDto,
    @Headers('authorization') authorization: string,
    @Res() response: Response
  ) {
    if (!authorization) {
      throw new UnauthorizedException('缺少授权信息');
    }
    
    // 处理授权信息
    const token = authorization.replace('Bearer ', '').trim();
    
    const difyQuery = await this.voiceNetService.convertDifyCompletionQuery(body, token);

    await this.difyChatService.chatMessages(difyQuery, response, token);
  }

  @Post('dify-completions')
  async difyCompletions(
    @Body() difyQuery: DifyQueryDto,
    @Headers('authorization') authorization: string,
    @Res() response: Response
  ) {
    if (!authorization) {
      throw new UnauthorizedException('缺少授权信息');
    }

    const token = authorization.replace('Bearer ', '').trim();

    const responseMode = get(difyQuery, 'response_mode', 'streaming');
    
    // 判断是否为流式响应
    if (responseMode === 'streaming') {
      // 使用SSE方式返回响应
      await this.difyChatService.chatMessages(difyQuery, response, token );
    } else if (responseMode === 'blocking') {
      // 对于非流式响应，可以采用普通JSON方式返回
      console.log(`发起阻塞式请求`, difyQuery);
      const llmResponse = await this.difyChatService.blockingChatMessages(difyQuery, token);
      response.status(200);
      response.json(llmResponse);
    }
    
  }

  @Post('completions')
  async completion(
    @Body() body: LLMQueryDto, 
    @Headers('authorization') authorization: string,
    @Session() session: Record<string, any>,
    @Res() response: Response
  ) {
    if (!authorization) {
      throw new UnauthorizedException('缺少授权信息');
    }
    
    // 处理授权信息，例如验证token
    // 通常authorization格式为: "Bearer your-token-here"
    const token = authorization.replace('Bearer ', '').trim();
    
    console.log('[chat] session:', session);
    // console.log('token:', token);
    console.log('headers:', authorization);
    console.log('completion body:', body);
    const userId = get(body, 'model', 'default-user');
    
    // 转换DTO
    const difyQuery = this.llmService.transformLLMToDifyQuery(body, userId);
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
      await this.difyChatService.chatMessages(difyQuery, response, token );
    } else if (responseMode === 'blocking') {
      // 对于非流式响应，可以采用普通JSON方式返回
      console.log(`发起阻塞式请求`, difyQuery);
      const llmResponse = await this.difyChatService.blockingChatMessages(difyQuery, token);
      response.status(200);
      response.json(llmResponse);
    }
  }
}
