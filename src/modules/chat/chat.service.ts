import type { Message as MessageRow } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ChatHistoryResponseDTO,
  ChatMessageDTO,
  MessageReactionDTO,
  ReactionKey,
  ReplyContextDTO,
} from './chat.dto.js';

const SYSTEM_SENDER = 'system';
const REPLY_SNIPPET_MAX = 140;

/**
 * Conversation IDs encode their kind. DMs are `dm:<a>:<b>` with the two IDs
 * sorted lexicographically; only the two participants may read. Groups use
 * `group:<uuid>` and currently have no membership table on this side, so we
 * accept any authed viewer (TODO once GroupMember lands).
 */
function assertCanRead(conversationId: string, viewerId: string): void {
  if (conversationId.startsWith('dm:')) {
    const [, a, b] = conversationId.split(':');
    if (!a || !b) throw ApiError.badRequest('Malformed conversationId');
    if (viewerId !== a && viewerId !== b) {
      throw ApiError.forbidden('Not a participant');
    }
    return;
  }
  if (conversationId.startsWith('group:')) return;
  throw ApiError.badRequest('Unknown conversation kind');
}

function replySnippet(type: string, content: string): string {
  return type === 'text' && content.length > REPLY_SNIPPET_MAX
    ? content.slice(0, REPLY_SNIPPET_MAX) + '…'
    : content;
}

function toReplyContext(parent: MessageRow | null): ReplyContextDTO | undefined {
  if (!parent || parent.deleted || parent.type === 'system') return undefined;
  return {
    id: parent.id,
    senderId: parent.senderId ?? SYSTEM_SENDER,
    senderName: parent.senderName,
    content: replySnippet(parent.type, parent.content),
    type: parent.type as ReplyContextDTO['type'],
  };
}

function rowToDto(
  row: MessageRow,
  replyTo: ReplyContextDTO | undefined,
  reactions: MessageReactionDTO[] | undefined,
): ChatMessageDTO {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId ?? SYSTEM_SENDER,
    senderName: row.senderName,
    content: row.content,
    timestamp: row.createdAt.getTime(),
    type: row.type as ChatMessageDTO['type'],
    ...(replyTo ? { replyTo } : {}),
    ...(row.editedAt ? { editedAt: row.editedAt.getTime() } : {}),
    ...(row.deleted ? { deleted: true } : {}),
    ...(reactions && reactions.length ? { reactions } : {}),
  };
}

/**
 * Resolve reply parents + reactions for the whole page in two batched
 * queries — never N+1. Mirrors socket-server message.store.hydrate.
 */
async function hydrate(rows: MessageRow[]): Promise<ChatMessageDTO[]> {
  if (rows.length === 0) return [];

  const parentIds = [
    ...new Set(rows.map((r) => r.replyToId).filter((v): v is string => !!v)),
  ];
  const messageIds = rows.map((r) => r.id);

  const [parents, reactions] = await Promise.all([
    parentIds.length
      ? prisma.message.findMany({ where: { id: { in: parentIds } } })
      : Promise.resolve([] as MessageRow[]),
    prisma.reaction.findMany({ where: { messageId: { in: messageIds } } }),
  ]);

  const parentById = new Map(parents.map((p) => [p.id, p]));
  const reactionsByMessage = new Map<string, MessageReactionDTO[]>();
  for (const r of reactions) {
    const list = reactionsByMessage.get(r.messageId) ?? [];
    list.push({
      userId: r.userId,
      userName: r.userName,
      emoji: r.emoji as ReactionKey,
    });
    reactionsByMessage.set(r.messageId, list);
  }

  return rows.map((r) =>
    rowToDto(
      r,
      r.replyToId ? toReplyContext(parentById.get(r.replyToId) ?? null) : undefined,
      reactionsByMessage.get(r.id),
    ),
  );
}

export const chatService = {
  /**
   * Cursor-paginated history. Scans newest-first from the cursor, reverses
   * so the page is oldest→newest (matches the socket-server wire shape and
   * the FE `select` flattener's "page[0] is newest" expectation when pages
   * are stacked).
   */
  async listHistory(
    conversationId: string,
    viewerId: string,
    cursor: number | undefined,
    limit: number,
  ): Promise<ChatHistoryResponseDTO> {
    assertCanRead(conversationId, viewerId);

    const rows = await prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = (hasMore ? rows.slice(0, limit) : rows).reverse();
    const messages = await hydrate(page);

    return {
      messages,
      nextCurosr:
        hasMore && page.length ? page[0].createdAt.getTime() : null,
      hasMore,
    };
  },
};
