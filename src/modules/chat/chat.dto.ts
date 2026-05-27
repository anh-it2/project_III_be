/**
 * Chat wire DTOs — must stay byte-aligned with the FE
 * (src/feature/chat/dto/chat.dto.ts in project_III) and the socket-server
 * payloads. The history endpoint exists so the FE can pull from the
 * authoritative DB instead of the socket-server's `chat:history` event.
 */

export type ChatMessageType = 'text' | 'image' | 'file' | 'video' | 'system';

export type ReactionKey = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export interface ReplyContextDTO {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'video';
}

export interface MessageReactionDTO {
  userId: string;
  userName: string;
  emoji: ReactionKey;
}

export interface ChatMessageDTO {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  type: ChatMessageType;
  replyTo?: ReplyContextDTO;
  editedAt?: number;
  deleted?: boolean;
  reactions?: MessageReactionDTO[];
}

/**
 * Cursor pagination response. `nextCurosr` typo is intentional — matches the
 * existing wire contract used by the FE `useMessages` infinite query.
 */
export interface ChatHistoryResponseDTO {
  messages: ChatMessageDTO[];
  nextCurosr: number | null;
  hasMore: boolean;
}
