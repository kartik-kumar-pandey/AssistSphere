import { prisma } from '../db/client.js';

export interface WhiteboardData {
  elements: unknown[];
  updatedAt: string;
}

const memory = new Map<string, WhiteboardData>();

export function getWhiteboard(sessionId: string): WhiteboardData {
  return memory.get(sessionId) || { elements: [], updatedAt: new Date().toISOString() };
}

export async function loadWhiteboard(sessionId: string): Promise<WhiteboardData> {
  const cached = memory.get(sessionId);
  if (cached) return cached;

  const row = await prisma.whiteboardSnapshot.findUnique({ where: { sessionId } });
  const data: WhiteboardData = {
    elements: (row?.elements as unknown[]) || [],
    updatedAt: row?.updatedAt.toISOString() || new Date().toISOString(),
  };
  memory.set(sessionId, data);
  return data;
}

export async function saveWhiteboard(sessionId: string, elements: unknown[]): Promise<WhiteboardData> {
  const data: WhiteboardData = { elements, updatedAt: new Date().toISOString() };
  memory.set(sessionId, data);

  await prisma.whiteboardSnapshot.upsert({
    where: { sessionId },
    create: { sessionId, elements: elements as object },
    update: { elements: elements as object },
  });

  return data;
}

export function clearWhiteboard(sessionId: string) {
  memory.delete(sessionId);
}

export async function deleteWhiteboard(sessionId: string) {
  memory.delete(sessionId);
  await prisma.whiteboardSnapshot.deleteMany({ where: { sessionId } });
}
