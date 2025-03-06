import { Injectable } from '@nestjs/common';
import { LLMQueryDto } from './dto/llm-query.dto';
import { DifyQueryDto } from './dto/dify-query.dto';
import { get } from 'lodash';

@Injectable()
export class LLMService {
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
      // 可以在这里添加其他输入参数
      conversation_history: llmQuery.messages
        .filter(message => message !== lastUserMessage) // 排除最后一条用户消息(已作为查询)
        .map(message => ({
          role: message.role,
          content: message.content
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
