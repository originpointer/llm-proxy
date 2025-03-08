import { Injectable, Logger } from '@nestjs/common';
import { SharedDataService } from './shared-data.service';

/**
 * 会话信息类型
 */
export interface ConversationInfo {
  id: string;           // 会话ID
  userId: string;       // 用户ID
  createdAt: Date;      // 创建时间
  updatedAt: Date;      // 最后更新时间
  messageCounts: number; // 消息数量
  metadata?: any;       // 元数据，可以存储任意附加信息
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private readonly conversationCache = new Map<string, ConversationInfo>();

  constructor(private readonly sharedDataService: SharedDataService) {}

  /**
   * 创建新会话或获取现有会话
   * @param userId 用户ID
   * @param conversationId 可选的会话ID
   * @returns 会话信息
   */
  createOrGetConversation(userId: string, conversationId?: string): ConversationInfo {
    // 如果提供了会话ID且存在，则返回
    if (conversationId && this.conversationCache.has(conversationId)) {
      const conversation = this.conversationCache.get(conversationId)!;
      // 更新时间
      conversation.updatedAt = new Date();
      return conversation;
    }

    // 检查现有会话ID
    const existingId = this.sharedDataService.getConversationId(userId);
    if (existingId && this.conversationCache.has(existingId)) {
      const conversation = this.conversationCache.get(existingId)!;
      // 更新时间
      conversation.updatedAt = new Date();
      return conversation;
    }

    // 创建新会话
    const now = new Date();
    const newId = conversationId || `conv-${Date.now()}-${userId}`;
    const newConversation: ConversationInfo = {
      id: newId,
      userId,
      createdAt: now,
      updatedAt: now,
      messageCounts: 0,
      metadata: {}
    };

    // 保存会话
    this.conversationCache.set(newId, newConversation);
    this.sharedDataService.setConversationId(userId, newId);
    this.logger.log(`为用户 ${userId} 创建新会话: ${newId}`);

    return newConversation;
  }

  /**
   * 获取会话信息
   * @param conversationId 会话ID
   * @returns 会话信息或null
   */
  getConversation(conversationId: string): ConversationInfo | null {
    return this.conversationCache.get(conversationId) || null;
  }

  /**
   * 获取用户的会话信息
   * @param userId 用户ID
   * @returns 会话信息或null
   */
  getUserConversation(userId: string): ConversationInfo | null {
    const conversationId = this.sharedDataService.getConversationId(userId);
    if (!conversationId) return null;
    return this.getConversation(conversationId);
  }

  /**
   * 更新会话元数据
   * @param conversationId 会话ID
   * @param metadata 元数据对象
   * @returns 更新后的会话信息或null
   */
  updateConversationMetadata(conversationId: string, metadata: any): ConversationInfo | null {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return null;

    conversation.metadata = {
      ...conversation.metadata,
      ...metadata
    };
    conversation.updatedAt = new Date();
    return conversation;
  }

  /**
   * 增加会话的消息计数
   * @param conversationId 会话ID
   * @param count 增加的数量，默认为1
   * @returns 更新后的计数
   */
  incrementMessageCount(conversationId: string, count: number = 1): number {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return 0;

    conversation.messageCounts += count;
    conversation.updatedAt = new Date();
    return conversation.messageCounts;
  }

  /**
   * 删除会话
   * @param conversationId 会话ID
   * @returns 是否成功删除
   */
  deleteConversation(conversationId: string): boolean {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return false;

    // 清除用户关联
    this.sharedDataService.setConversationId(conversation.userId, '');
    
    // 删除会话
    return this.conversationCache.delete(conversationId);
  }

  /**
   * 获取用户的所有会话
   * @returns 所有会话的列表
   */
  getAllConversations(): ConversationInfo[] {
    return Array.from(this.conversationCache.values());
  }

  /**
   * 获取指定用户的所有会话
   * @param userId 用户ID
   * @returns 用户的所有会话
   */
  getUserConversations(userId: string): ConversationInfo[] {
    return this.getAllConversations().filter(conv => conv.userId === userId);
  }
} 