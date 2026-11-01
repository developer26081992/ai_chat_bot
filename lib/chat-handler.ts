import { auth } from '@clerk/nextjs/server';
import { createChatHandler } from './chat-service';
import { startTurn, finishTurn, saveTitle } from './chat-repository';
import { retrieve, generateTitle, streamAnswer } from './chat-models';

// Both the HTTP API and the form action run the same authenticated RAG pipeline.
export const handleChat = createChatHandler({
  authenticate: async () => (await auth()).userId,
  configured: () => Boolean(process.env.OPENAI_API_KEY),
  startTurn, finishTurn, saveTitle, retrieve, generateTitle, streamAnswer,
});
