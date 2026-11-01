'use client';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import Link from 'next/link';
type Document = { id: string; name: string; createdAt: string; _count: { chunks: number } };
function Library() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const response = await fetch('/api/documents');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setDocuments(data.documents);
  }
  useEffect(() => { refresh().catch(() => setStatus('Unable to load documents. Check database configuration.')); }, []);
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setStatus('Extracting text, creating embeddings, and saving your document...');
    try {
      const response = await fetch('/api/documents/upload', { method: 'POST', body: new FormData(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStatus(`Saved ${data.name} with ${data.chunkCount} searchable chunks.`);
      form.reset(); await refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Upload failed.'); }
    finally { setBusy(false); }
  }
  return <><form onSubmit={upload} className="my-8 space-y-5 rounded-xl border bg-white p-6"><label className="block font-semibold" htmlFor="file">Upload a document</label><p className="text-sm text-slate-600">PDF or UTF-8 text · Up to 4 MiB · Text-based PDFs, up to 200 pages</p><input id="file" name="file" type="file" accept=".pdf,.txt" required disabled={busy} className="block w-full"/><button disabled={busy} className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Processing...' : 'Upload and index'}</button><p role="status" aria-live="polite" className="text-sm">{status}</p></form><h2 className="mb-4 text-xl font-semibold">Your documents</h2>{documents.length === 0 ? <p className="text-slate-600">Your uploaded documents will appear here.</p> : <ul className="divide-y rounded-xl border bg-white">{documents.map(doc => <li key={doc.id} className="flex items-center justify-between gap-4 p-5"><span className="break-all font-medium">{doc.name}</span><span className="shrink-0 text-sm text-slate-600">{doc._count.chunks} chunks</span></li>)}</ul>}</>;
}
export default function Page() {
  return <main className="mx-auto max-w-3xl px-6 py-12"><header className="flex flex-wrap items-center justify-between gap-4"><span className="text-sm font-semibold uppercase tracking-widest text-blue-700">RAG / Document Library</span><div className="flex items-center gap-5"><Link href="/chat" className="text-sm font-semibold text-blue-700 hover:underline">Open chat</Link><SignedIn><UserButton/></SignedIn></div></header><h1 className="mt-12 text-4xl font-bold tracking-tight">Knowledge starts here.</h1><p className="mt-4 text-slate-600">Add your documents to build your private knowledge base. Each file is split into overlapping chunks and indexed for semantic retrieval.</p><SignedOut><div className="mt-8"><SignInButton mode="modal"><button className="rounded-lg bg-blue-700 px-5 py-3 text-white">Sign in to get started</button></SignInButton></div></SignedOut><SignedIn><Library/></SignedIn></main>;
}
