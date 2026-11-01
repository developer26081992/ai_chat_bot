import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { getConversation, getWorkspaceData } from '@/lib/conversations';
import { ChatAccessState } from '@/components/chat/access-state';
import { ChatWorkspace } from '@/components/chat/workspace';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return <ChatAccessState configured={false} />;
  const { userId } = await auth();
  if (!userId) return <ChatAccessState />;
  const { id } = await params;
  const conversation = await getConversation(userId, id);
  if (!conversation) notFound();
  const data = await getWorkspaceData(userId);
  return <ChatWorkspace key={conversation.id} {...data} initialConversation={conversation} />;
}
