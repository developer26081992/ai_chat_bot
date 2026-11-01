import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const documents = await db.document.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, name: true, createdAt: true, _count: { select: { chunks: true } } } });
    return Response.json({ documents });
  } catch { return Response.json({ error: 'Unable to load documents.' }, { status: 503 }); }
}
