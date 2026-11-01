'use client';

import Link from 'next/link';

export default function ChatError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-xl px-6 py-20"><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Conversation workspace</p><h1 className="mt-4 text-2xl font-semibold">Unable to load this conversation.</h1><p className="mt-3 text-sm leading-7 text-slate-600">The workspace could not be loaded. Please try again shortly.</p><div className="mt-7 flex items-center gap-5"><button onClick={reset} className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Try again</button><Link href="/" className="text-sm font-medium text-blue-700 hover:underline">Document library</Link></div></main>;
}
