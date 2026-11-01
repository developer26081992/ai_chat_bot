import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
export const metadata = { title: 'Document Library | RAG Chatbot', description: 'Upload and index your documents for retrieval augmented generation.' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider><html lang="en"><body>{children}</body></html></ClerkProvider>;
}
