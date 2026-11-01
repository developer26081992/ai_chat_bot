export type SourceCitation = {
  number: number;
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  sources: SourceCitation[];
  status: 'complete' | 'streaming' | 'failed';
};

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentOption = { id: string; name: string };
export type ConversationDetail = ConversationSummary & {
  documentIds: string[];
  messages: ChatMessage[];
};

export type ChatStreamEvent =
  | { type: 'conversation'; conversation: ConversationSummary }
  | { type: 'sources'; messageId: string; sources: SourceCitation[] }
  | { type: 'delta'; messageId: string; text: string }
  | { type: 'title'; title: string }
  | { type: 'done'; message: ChatMessage }
  | { type: 'error'; error: string };
