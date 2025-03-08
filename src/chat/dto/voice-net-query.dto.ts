import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MessageDto {
    @IsString()
    @IsNotEmpty()
    role: string; // 可取值: 'user' | 'assistant' | 'system'

    @IsString()
    @IsOptional()
    content?: string; // 对话内容
}

export class StreamOptionsDto {
    @IsBoolean()
    @IsOptional()
    include_usage?: boolean; // 填入值: true
}

export class VoiceNetQueryDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MessageDto)
    @IsNotEmpty()
    messages: MessageDto[]; // 对话消息数组

    @IsBoolean()
    @IsOptional()
    stream?: boolean; // 填入值: true

    @IsObject()
    @IsOptional()
    stream_options?: StreamOptionsDto; // 透传 StartVoiceChat.LLMConfig.StreamOptions

    @IsNumber()
    @IsOptional()
    maxTokens?: number; // 透传 StartVoiceChat.LLMConfig.MaxTokens

    @IsString()
    @IsNotEmpty()
    model: string; // 用户id
}