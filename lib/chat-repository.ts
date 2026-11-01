import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { ChatError, normalizeTitle, type ChatInput } from './chat-domain';
import { serializeConversation, serializeMessage } from './conversations';
import type { PreparedTurn } from './chat-service';
import type { ChatMessage, SourceCitation } from './chat-types';

export async function startTurn(userId: string, input: ChatInput): Promise<PreparedTurn> {
  const generationId = randomUUID();
  return db.$transaction(async tx => {
    let conversation = input.conversationId ? await tx.conversation.findFirst({ where: { id: input.conversationId, userId } }) : null;
    if (input.conversationId && !conversation) throw new ChatError(404, 'Conversation not found.');
    const documentIds = conversation?.documentIds ?? input.documentIds ?? [];
    if (documentIds.length === 0) throw new ChatError(409, 'This conversation has no selected documents. Start a new conversation.');
    const documents = await tx.document.findMany({ where: { userId, id: { in: documentIds } }, select: { id: true } });
    if (documents.length !== documentIds.length) throw new ChatError(404, 'One or more selected documents are unavailable.');
    if (!conversation) {
      conversation = await tx.conversation.create({ data: { userId, documentIds, title: normalizeTitle(input.message) } });
    }
    // The row update serializes concurrent requests, including requests from other tabs.
    const claimed = await tx.conversation.updateMany({
      where: { id: conversation.id, userId, OR: [
        { generationId: null },
        { generationStartedAt: { lt: new Date(Date.now() - 120000) } },
      ] },
      data: { generationId, generationStartedAt: new Date() },
    });
    if (claimed.count !== 1) throw new ChatError(409, 'A reply is already being generated. Please wait and reopen the conversation.');
    await tx.message.updateMany({ where: { conversationId: conversation.id, status: 'streaming' }, data: { status: 'failed' } });
    const latest = await tx.message.aggregate({ where: { conversationId: conversation.id }, _max: { sequence: true } });
    const previousSequence = latest._max.sequence ?? 0;
    await tx.message.create({ data: { conversationId: conversation.id, role: 'user', content: input.message, sequence: previousSequence + 1 } });
    const assistant = await tx.message.create({ data: { conversationId: conversation.id, role: 'assistant', content: '', sequence: previousSequence + 2, status: 'streaming' } });
    const history = await tx.message.findMany({
      where: { conversationId: conversation.id, status: 'complete' }, orderBy: { sequence: 'desc' }, take: 40,
    });
    // Use the timestamp from the claim rather than the pre-update conversation row.
    const updated = await tx.conversation.findUniqueOrThrow({ where: { id: conversation.id } });
    return { conversation: serializeConversation(updated), documentIds, assistant: serializeMessage(assistant),
      history: history.reverse().map(serializeMessage), isFirstTurn: previousSequence === 0, generationId };
  }, { timeout: 15000 });
}

export async function finishTurn(turn: PreparedTurn, userId: string, content: string, sources: SourceCitation[], status: 'complete' | 'failed'): Promise<ChatMessage> {
  return db.$transaction(async tx => {
    const released = await tx.conversation.updateMany({
      where: { id: turn.conversation.id, userId, generationId: turn.generationId },
      data: { generationId: null, generationStartedAt: null },
    });
    if (released.count !== 1) throw new ChatError(409, 'The reply was superseded by another request.');
    const message = await tx.message.update({
      where: { id: turn.assistant.id, conversationId: turn.conversation.id },
      data: { content, status, sources: sources.map(source => ({ ...source })) as Prisma.InputJsonValue },
    });
    return serializeMessage(message);
  }, { timeout: 15000 });
}

export async function saveTitle(userId: string, conversationId: string, title: string): Promise<void> {
  await db.conversation.updateMany({ where: { id: conversationId, userId }, data: { title } });
}
