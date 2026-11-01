'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { submitChat } from '@/app/chat/actions';
import type { ChatMessage, ChatStreamEvent, ConversationDetail, ConversationSummary, DocumentOption } from '@/lib/chat-types';
import { MessageContent } from './citations';
import { WorkspaceSidebar } from './sidebar';
import { readChatStream } from './stream';

export function ChatWorkspace({ conversations, documents, initialConversation }: { conversations: ConversationSummary[]; documents: DocumentOption[]; initialConversation?: ConversationDetail }) {
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationSummary | undefined>(initialConversation);
  const [items, setItems] = useState(conversations);
  const [messages, setMessages] = useState<ChatMessage[]>(initialConversation?.messages ?? []);
  const [documentIds, setDocumentIds] = useState<string[]>(initialConversation?.documentIds ?? []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState(initialConversation?.messages.length ? 'Conversation loaded. Saved messages are ready.' : 'Choose documents and ask your first question.');
  const bottom = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const nearBottom = useRef(true);
  const lastServerSnapshot = useRef(initialConversation);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!busy && initialConversation && lastServerSnapshot.current !== initialConversation) {
      lastServerSnapshot.current = initialConversation;
      setConversation(initialConversation);
      setMessages(initialConversation.messages);
      setDocumentIds(initialConversation.documentIds);
      setItems(conversations);
    }
  }, [initialConversation, conversations, busy]);
  useEffect(() => {
    if (nearBottom.current) bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy]);

  function updateConversation(next: ConversationSummary) {
    setConversation(next);
    setItems(current => [next, ...current.filter(item => item.id !== next.id)]);
  }

  const [, formAction, pending] = useActionState(async (_state: null, form: FormData) => {
    await submit(form);
    return null;
  }, null);

  async function submit(form: FormData) {
    const question = String(form.get('message') ?? '').trim();
    if (busy || !question || (!conversation && !documentIds.length)) return;
    const userId = crypto.randomUUID();
    const placeholderId = crypto.randomUUID();
    let assistantId = placeholderId;
    let nextConversation = conversation;
    let accepted = false;
    let completed = false;
    let streamError = '';
    const now = new Date().toISOString();
    const abortController = new AbortController();
    controller.current = abortController;
    setBusy(true);
    setError('');
    setAnnouncement('Building an answer from your selected documents.');
    setInput('');
    nearBottom.current = true;
    setMessages(current => [...current, { id: userId, role: 'user', content: question, createdAt: now, sources: [], status: 'complete' }, { id: placeholderId, role: 'assistant', content: '', createdAt: now, sources: [], status: 'streaming' }]);

    function updateAssistant(update: (message: ChatMessage) => ChatMessage) {
      const currentId = assistantId;
      setMessages(current => current.map(message => message.id === placeholderId || message.id === currentId ? update(message) : message));
    }
    function receive(event: ChatStreamEvent) {
      switch (event.type) {
        case 'conversation':
          accepted = true;
          nextConversation = event.conversation;
          updateConversation(event.conversation);
          break;
        case 'sources': {
          const previousId = assistantId;
          assistantId = event.messageId;
          setMessages(current => current.map(message => message.id === placeholderId || message.id === previousId ? { ...message, id: event.messageId, sources: event.sources } : message));
          break;
        }
        case 'delta':
          updateAssistant(message => ({ ...message, content: message.content + event.text }));
          break;
        case 'title':
          if (nextConversation) {
            nextConversation = { ...nextConversation, title: event.title };
            updateConversation(nextConversation);
          }
          break;
        case 'done':
          completed = true;
          updateAssistant(() => event.message);
          setAnnouncement('Answer saved. Read the response and cited sources above.');
          break;
        case 'error':
          streamError = event.error;
          break;
      }
    }

    try {
      const result = await submitChat(form);
      if (result.error !== undefined) throw new Error(result.error);
      if (abortController.signal.aborted) { await result.stream.cancel(); return; }
      await readChatStream(result.stream, receive, abortController.signal);
      if (streamError || !completed) throw new Error(streamError || 'The response was interrupted. Reload to check the saved conversation.');
      if (nextConversation) {
        router.replace(`/chat/${nextConversation.id}`, { scroll: false });
        router.refresh();
      }
    } catch (cause) {
      if (abortController.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'The response could not be completed.');
      setAnnouncement(accepted ? 'Response interrupted. Open the saved conversation to check its status.' : 'Your question could not be sent. Check the error message for details.');
      if (!accepted) {
        setInput(question);
        setMessages(current => current.filter(message => message.id !== userId && message.id !== placeholderId));
      } else {
        updateAssistant(message => ({ ...message, status: 'failed' }));
      }
    } finally {
      if (!abortController.signal.aborted) setBusy(false);
    }
  }

  const documentNames = documentIds.map(id => documents.find(document => document.id === id)?.name ?? 'Unavailable document');
  return <div className="min-h-screen md:flex">
    <WorkspaceSidebar conversations={items} activeId={conversation?.id} onNewConversation={() => controller.current?.abort()} />
    <main className="flex h-[calc(100dvh-53px)] min-w-0 flex-1 flex-col md:h-screen">
      <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">Document conversation</p><h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-900">{conversation?.title ?? 'New conversation'}</h1><p className="mt-1 text-xs text-slate-500">Answers with sources you can open and read.</p></header>
      <div className="min-h-0 flex-1 overflow-y-auto" onScroll={event => {
        const target = event.currentTarget;
        nearBottom.current = target.scrollHeight - target.scrollTop - target.clientHeight < 160;
      }}>
        <div className="mx-auto max-w-3xl px-5 py-7 sm:px-8">
          {!conversation ? <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="document-selector-heading"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="document-selector-heading" className="text-sm font-semibold text-slate-900">Choose your sources</h2><span className="text-xs text-slate-500">{documentIds.length}/10 selected</span></div><p className="mt-2 text-sm leading-6 text-slate-600">Select the documents for this conversation. Your questions will use these sources.</p>{documents.length ? <fieldset disabled={busy} className="mt-4 max-h-52 space-y-2 overflow-y-auto"><legend className="sr-only">Documents to include</legend>{documents.map(document => <label key={document.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm transition-colors has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50"><input className="mt-0.5 h-4 w-4 shrink-0 accent-blue-700" type="checkbox" value={document.id} checked={documentIds.includes(document.id)} disabled={!documentIds.includes(document.id) && documentIds.length >= 10} onChange={event => setDocumentIds(current => event.target.checked ? [...current, document.id] : current.filter(id => id !== document.id))} /><span className="break-all text-slate-700">{document.name}</span></label>)}</fieldset> : <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-sm text-slate-600">Upload a document to start a conversation.</p><Link href="/" className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline">Open document library &rarr;</Link></div>}</section> : <section aria-label="Conversation documents" className="mb-7 border-b border-slate-200 pb-5"><h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sources in this conversation</h2><ul className="mt-2 flex flex-wrap gap-2">{documentNames.map((name, index) => <li key={documentIds[index]} className="max-w-full break-all rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">{name}</li>)}</ul>{!documentNames.length && <p className="mt-2 text-sm text-slate-500">This conversation has no selected documents.</p>}</section>}
          {!messages.length && <div className="py-8 sm:py-14"><span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">A question is a starting point</span><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">What would you like to understand?</h2><p className="mt-4 max-w-lg text-sm leading-7 text-slate-600">Ask about a topic, compare details, or find a passage. Open the numbered citations in each answer to see the original document text.</p></div>}
          <section aria-label="Messages" aria-busy={busy} className="space-y-7">{messages.map(message => <article key={message.id} className={message.role === 'user' ? 'ml-4 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 sm:ml-12' : 'rounded-xl border border-slate-200 bg-white px-5 py-5'}><h2 className={`mb-3 text-[11px] font-bold uppercase tracking-wider ${message.role === 'user' ? 'text-blue-800' : 'text-slate-500'}`}>{message.role === 'user' ? 'You' : 'Assistant'}</h2>{message.content ? <MessageContent message={message} /> : message.status === 'streaming' && busy ? <p className="animate-pulse text-sm text-slate-500">Finding the relevant passages...</p> : <p className="text-sm text-slate-500">No answer was saved.</p>}{message.status === 'failed' && <p className="mt-4 border-t border-amber-100 pt-3 text-xs leading-5 text-amber-800">This response was not completed. Reload to check the saved history before continuing.</p>}{message.status === 'streaming' && !busy && <p className="mt-4 text-xs leading-5 text-amber-800">This response is still processing or was interrupted. Reload to check its status.</p>}</article>)}</section>
          <div ref={bottom} />
        </div>
      </div>
      <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-8"><form action={formAction} className="mx-auto max-w-3xl">{conversation && <input type="hidden" name="conversationId" value={conversation.id} />}{!conversation && documentIds.map(id => <input key={id} type="hidden" name="documentIds" value={id} />)}<label htmlFor="chat-message" className="sr-only">Your question</label>{error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}{conversation && <a href={`/chat/${conversation.id}`} className="ml-2 font-semibold underline">View saved conversation</a>}</p>}<div className="flex items-end gap-3 rounded-xl border border-slate-300 bg-slate-50 p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"><textarea id="chat-message" name="message" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} disabled={busy || (!conversation && !documents.length)} maxLength={8000} rows={2} placeholder="Ask a question about your documents..." className="max-h-44 min-h-16 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-500 disabled:opacity-60" /><button disabled={busy || pending || !input.trim() || (!conversation && !documentIds.length)} type="submit" className="mb-1 shrink-0 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Answering...' : 'Send'}</button></div><p role="status" aria-live="polite" aria-atomic="true" className="mt-2 text-[11px] leading-5 text-slate-600">{announcement}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Enter to send. Shift+Enter for a new line.</p></form></div>
    </main>
  </div>;
}
