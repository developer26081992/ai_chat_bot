import Link from 'next/link';
import { SignInButton } from '@clerk/nextjs';

export function ChatAccessState({ configured = true }: { configured?: boolean }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-8 text-sm font-semibold text-blue-700 hover:underline">RAG / Document Library</Link>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Your research workspace</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Keep the conversation going.</h1>
      <p className="mt-4 leading-7 text-slate-600">
        {configured
          ? 'Sign in to ask questions about your documents and revisit your conversations with their original sources.'
          : 'Add your Clerk publishable key to the environment settings to enable sign-in and conversations.'}
      </p>
      {configured && <div className="mt-8"><SignInButton mode="modal"><button className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">Sign in to continue</button></SignInButton></div>}
    </main>
  );
}
