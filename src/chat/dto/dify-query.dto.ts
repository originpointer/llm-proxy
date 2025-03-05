import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";

export class DifyFileDto {
    @IsString()
    @IsNotEmpty()
    type: string;
    @IsString()
    @IsNotEmpty()
    transfer_method: string;
    @IsString()
    @IsNotEmpty()
    url: string;
}
export class DifyQueryDto {
    // 未知
    @IsObject()
    @IsOptional()
    inputs: any;
    
    @IsString()
    @IsNotEmpty()
    query: string; // 本次调用接口的查询内容
    
    @IsString()
    @IsNotEmpty()
    response_mode: string; // 返回值类型 已知有 streaming（流式）
    
    @IsString()
    @IsNotEmpty()
    user: string; // 用户或账户
    
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DifyFileDto)
    @IsOptional()
    files: DifyFileDto[]; // 文件列表

    // 添加LLM相关参数
    @IsNumber()
    @IsOptional()
    temperature?: number; // 温度参数，控制随机性

    @IsNumber()
    @IsOptional()
    max_tokens?: number; // 最大生成Token数
    
    @IsString()
    @IsOptional()
    model?: string; // 模型名称
    
    @IsNumber()
    @IsOptional()
    top_p?: number; // Top-p采样参数
}