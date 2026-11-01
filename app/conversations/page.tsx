import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { getWorkspaceData } from '@/lib/conversations';
import { ChatAccessState } from '@/components/chat/access-state';
import { ConversationTime, WorkspaceSidebar } from '@/components/chat/sidebar';

export const dynamic = 'force-dynamic';

export default async function ConversationsPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return <ChatAccessState configured={false} />;
  const { userId } = await auth();
  if (!userId) return <ChatAccessState />;
  const { conversations } = await getWorkspaceData(userId);
  return <div className="min-h-screen md:flex"><WorkspaceSidebar conversations={conversations} /><main className="min-w-0 flex-1 px-5 py-10 sm:px-10"><div className="mx-auto max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Your workspace</p><div className="mt-3 flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-bold tracking-tight">Conversations</h1><span className="text-sm text-slate-500">{conversations.length} saved</span></div><p className="mt-3 text-sm leading-7 text-slate-600">Pick up a question where you left it. Your messages and cited passages stay together.</p>{conversations.length ? <ul className="mt-8 divide-y divide-slate-200 border-y border-slate-200">{conversations.map(conversation => <li key={conversation.id}><Link href={`/chat/${conversation.id}`} className="group flex flex-wrap items-center justify-between gap-3 px-2 py-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"><span className="min-w-0 break-words text-lg font-semibold text-slate-800 group-hover:text-blue-700">{conversation.title}</span><span className="text-xs text-slate-500"><ConversationTime value={conversation.updatedAt} /></span></Link></li>)}</ul> : <section className="mt-10 border-t border-slate-200 pt-10"><h2 className="text-xl font-semibold">Your first conversation starts here.</h2><p className="mt-3 max-w-md text-sm leading-7 text-slate-600">Choose a document, ask a question, and return any time to explore the answer and its sources.</p><Link href="/chat" className="mt-6 inline-block rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">New conversation</Link></section>}</div></main></div>;
}
