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
                finish_reason: null
            }],
            stream_options: { include_usage: true }  // 将 stream_options 移到 choices 数组外
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