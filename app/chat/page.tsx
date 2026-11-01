import { auth } from '@clerk/nextjs/server';
import { getWorkspaceData } from '@/lib/conversations';
import { ChatAccessState } from '@/components/chat/access-state';
import { ChatWorkspace } from '@/components/chat/workspace';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export default async function NewChatPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return <ChatAccessState configured={false} />;
  const { userId } = await auth();
  if (!userId) return <ChatAccessState />;
  const data = await getWorkspaceData(userId);
  return <ChatWorkspace key="new-conversation" {...data} />;
}
