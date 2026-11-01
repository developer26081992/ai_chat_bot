'use client';

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import type { ConversationSummary } from '@/lib/chat-types';

export function ConversationTime({ value }: { value: string }) {
  const date = new Date(value);
  return <time dateTime={value}>{new Intl.DateTimeFormat('en-ZA', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' }).format(date)} SAST</time>;
}

export function ConversationLinks({ conversations, activeId }: { conversations: ConversationSummary[]; activeId?: string }) {
  if (!conversations.length) return <p className="px-3 py-5 text-sm leading-6 text-slate-500">Your saved conversations will appear here after your first question.</p>;
  return <ul className="space-y-1">{conversations.map(conversation => (
    <li key={conversation.id}>
      <Link href={`/chat/${conversation.id}`} aria-current={conversation.id === activeId ? 'page' : undefined} className={`block rounded-lg px-3 py-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 ${conversation.id === activeId ? 'bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-100' : 'text-slate-700 hover:bg-slate-100'}`}>
        <span className="block break-words text-sm font-semibold leading-5">{conversation.title}</span>
        <span className="mt-1.5 block text-[11px] leading-4 text-slate-500"><ConversationTime value={conversation.updatedAt} /></span>
      </Link>
    </li>
  ))}</ul>;
}

export function WorkspaceSidebar({ conversations, activeId, onNewConversation }: { conversations: ConversationSummary[]; activeId?: string; onNewConversation?: () => void }) {
  function Navigation() {
    return <>
      <Link href="/" className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">RAG / Workspace</Link>
      <a href="/chat" onClick={onNewConversation} className="mt-7 flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"><span aria-hidden="true">+</span> New conversation</a>
      <div className="mb-3 mt-8 flex items-center justify-between gap-2 px-3"><h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Conversations</h2><Link href="/conversations" className="text-xs font-medium text-blue-700 hover:underline">View all</Link></div>
      <nav aria-label="Conversations" className="min-h-0 flex-1 overflow-y-auto"><ConversationLinks conversations={conversations} activeId={activeId} /></nav>
      <footer className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5"><Link href="/" className="text-sm font-medium text-slate-600 hover:text-blue-700">Document library</Link><UserButton /></footer>
    </>;
  }
  return <>
    <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white p-5 md:flex"><Navigation /></aside>
    <details className="border-b border-slate-200 bg-white md:hidden"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-blue-800">Workspace &amp; conversations</summary><aside className="flex max-h-[70vh] flex-col px-5 pb-5"><Navigation /></aside></details>
  </>;
}
