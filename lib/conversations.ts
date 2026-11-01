import type { Conversation, Message } from '@prisma/client';
import { db } from './db';
import { parseSources } from './chat-domain';
import type { ChatMessage, ConversationDetail, ConversationSummary, DocumentOption } from './chat-types';

export function serializeConversation(row: Conversation): ConversationSummary {
  return { id: row.id, title: row.title, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export function serializeMessage(row: Message): ChatMessage {
  return {
    id: row.id,
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    sources: parseSources(row.sources),
    status: row.status === 'streaming' ? 'streaming' : row.status === 'failed' ? 'failed' : 'complete',
  };
}

export async function getWorkspaceData(userId: string): Promise<{ conversations: ConversationSummary[]; documents: DocumentOption[] }> {
  const [conversations, documents] = await Promise.all([
    db.conversation.findMany({ where: { userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] }),
    db.document.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, name: true } }),
  ]);
  return { conversations: conversations.map(serializeConversation), documents };
}

export async function getConversation(userId: string, id: string): Promise<ConversationDetail | null> {
  const conversation = await db.conversation.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { sequence: 'asc' } } },
  });
  if (!conversation) return null;
  return {
    ...serializeConversation(conversation),
    documentIds: conversation.documentIds,
    messages: conversation.messages.map(serializeMessage),
  };
}
