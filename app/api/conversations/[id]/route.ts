import { auth } from '@clerk/nextjs/server';
import { getConversation } from '@/lib/conversations';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  try {
    const conversation = await getConversation(userId, id);
    return conversation ? Response.json({ conversation }) : Response.json({ error: 'Conversation not found.' }, { status: 404 });
  } catch { return Response.json({ error: 'Unable to load the conversation.' }, { status: 503 }); }
}
