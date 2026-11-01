'use client';

import { Fragment } from 'react';
import type { ChatMessage, SourceCitation } from '@/lib/chat-types';

function citedSources(content: string, sources: SourceCitation[]) {
  const numbers = new Set(Array.from(content.matchAll(/\[(\d+)\]/g), match => Number(match[1])));
  return sources.filter(source => numbers.has(source.number));
}

export function MessageContent({ message }: { message: ChatMessage }) {
  const sources = citedSources(message.content, message.sources);
  const byNumber = new Map(sources.map(source => [source.number, source]));
  const parts = message.content.split(/(\[\d+\])/g);
  function revealSource(number: number) {
    const element = document.getElementById(`source-${message.id}-${number}`);
    if (element instanceof HTMLDetailsElement) {
      element.open = true;
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      element.querySelector('summary')?.focus({ preventScroll: true });
    }
  }
  return <>
    <div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-800">{parts.map((part, index) => {
      const match = part.match(/^\[(\d+)\]$/);
      const number = match ? Number(match[1]) : null;
      return number !== null && byNumber.has(number)
        ? <button key={index} type="button" onClick={() => revealSource(number)} aria-label={`Read source ${number}: ${byNumber.get(number)!.documentName}`} className="mx-0.5 inline rounded border border-blue-200 bg-blue-50 px-1.5 align-baseline text-xs font-semibold leading-5 text-blue-800 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">[{number}]</button>
        : <Fragment key={index}>{part}</Fragment>;
    })}</div>
    {sources.length > 0 && <section className="mt-5 border-t border-slate-200 pt-4" aria-label="Cited sources"><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cited sources</h3><div className="space-y-2">{sources.map(source => (
      <details id={`source-${message.id}-${source.number}`} key={source.number} className="group rounded-lg border border-slate-200 bg-slate-50 open:bg-white">
        <summary className="cursor-pointer rounded-lg px-3 py-3 text-sm text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"><span className="font-semibold text-blue-800">[{source.number}]</span><span className="ml-2 break-words font-medium">{source.documentName}</span><span className="ml-2 text-xs text-slate-500">Chunk {source.chunkIndex + 1}</span></summary>
        <blockquote className="mx-4 mb-4 border-l-2 border-blue-200 pl-4 text-sm leading-7 text-slate-600"><p className="whitespace-pre-wrap break-words">{source.content}</p></blockquote>
      </details>
    ))}</div></section>}
  </>;
}
