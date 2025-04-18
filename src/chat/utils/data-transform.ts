import {get, set} from "lodash";

export function convertToOpenAIFormat(difyData) {
    // 处理不同类型的事件
    if (difyData.event === 'message') {
        // 创建基本响应结构
        const response = {
            id: `chatcmpl-${get(difyData, 'id', Date.now())}`,
            object: 'chat.completion.chunk',
            created: get(difyData, 'created_at', Date.now() / 1000),
            model: 'dify-proxy',
            choices: [{
                delta: {
                    content: difyData.answer || ''
                },
                index: 0,
                finish_reason: null,
                
            }],
            // 将 stream_options 移到 choices 数组外
            stream_options: { include_usage: true }
        };

        // 如果是第一个消息块，添加 role 字段
        if (difyData.id === 0 || difyData.answer === '') {
            set(response, 'choices.0.delta.Role', 'assistant');// 使用大写的 Role
        }

        return response;
    } else if (difyData.event === 'message_end') {
        // 忽略message_end事件，我们会在stream.on('end')中发送结束消息
        return null;
    } else if (difyData.event === 'error') {
        console.error('Dify API错误:', difyData);
        return null;
    }

    // 忽略其他类型的事件
    return null;
}


export function convertBlockingToOpenAiFormat(difyResponse) {
    const id = get(difyResponse, 'id', Date.now());
    const createAt = get(difyResponse, 'created_at', Date.now() / 1000);
    const answer = get(difyResponse, 'answer', '');
    return {
        id: `chatcmpl-${id}`,
        object: 'chat.completion',
        created: createAt,
        model: 'dify-proxy',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: answer
          },
          finish_reason: 'stop'
        }],
        usage: difyResponse.metadata?.usage ? {
          prompt_tokens: difyResponse.metadata.usage.prompt_tokens || 0,
          completion_tokens: difyResponse.metadata.usage.completion_tokens || 0,
          total_tokens: difyResponse.metadata.usage.total_tokens || 0
        } : {
          prompt_tokens: 1,  // 默认值
          completion_tokens: 2,  // 默认值
          total_tokens: 3  // 默认值
        }
      };
}