import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { serializeConversation } from '@/lib/conversations';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const conversations = await db.conversation.findMany({ where: { userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] });
    return Response.json({ conversations: conversations.map(serializeConversation) });
  } catch { return Response.json({ error: 'Unable to load conversations.' }, { status: 503 }); }
}
