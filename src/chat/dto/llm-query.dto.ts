import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MessageDto {
    @IsString()
    @IsNotEmpty()
    role: string; // 可取值: 'user' 或 'assistant'

    @IsString()
    @IsOptional()
    content?: string; // 对话内容
}

export class LLMQueryDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MessageDto)
    @IsNotEmpty()
    messages: MessageDto[]; // 对话消息数组

    @IsBoolean()
    @IsOptional()
    stream?: boolean; // 填入值: true

    @IsNumber()
    @IsOptional()
    temperature?: number; // 透传 StartVoiceChat.LLMConfig.temperature

    @IsNumber()
    @IsOptional()
    maxTokens?: number; // 透传 StartVoiceChat.LLMConfig.MaxTokens

    @IsString()
    @IsNotEmpty()
    model: string; // 透传 StartVoiceChat.LLMConfig.ModelName

    @IsNumber()
    @IsOptional()
    top_p?: number; // 透传 StartVoiceChat.LLMConfig.TopP
}