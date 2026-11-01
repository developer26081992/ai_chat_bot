import Link from 'next/link';

export default function ConversationNotFound() {
  return <main className="mx-auto max-w-xl px-6 py-20"><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Conversation workspace</p><h1 className="mt-4 text-2xl font-semibold">Conversation not found.</h1><p className="mt-3 text-sm leading-7 text-slate-600">This conversation is unavailable or does not belong to your account.</p><Link href="/chat" className="mt-7 inline-block rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">Start a new conversation</Link></main>;
}
