import { Injectable } from '@nestjs/common';

@Injectable()
export class SharedDataService {
  // 存储会话 ID 的 Map
  private readonly conversationIdMap = new Map<string, string>();
  
  // 存储其他可能需要共享的数据
  private readonly sharedData = new Map<string, any>();

  // 获取会话 ID
  getConversationId(userId: string): string {
    return this.conversationIdMap.get(userId) || '';
  }

  // 设置会话 ID
  setConversationId(userId: string, conversationId: string): void {
    this.conversationIdMap.set(userId, conversationId);
  }

  // 存储任意共享数据
  setData(key: string, value: any): void {
    this.sharedData.set(key, value);
  }

  // 获取共享数据
  getData(key: string): any {
    return this.sharedData.get(key);
  }

  // 检查是否存在某个键
  hasData(key: string): boolean {
    return this.sharedData.has(key);
  }

  // 删除数据
  deleteData(key: string): boolean {
    return this.sharedData.delete(key);
  }

  // 清除所有数据
  clearData(): void {
    this.sharedData.clear();
  }
} 