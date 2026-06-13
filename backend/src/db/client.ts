import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function connectDb() {
  await prisma.$connect();
}
