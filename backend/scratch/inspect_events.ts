import { prisma } from '../src/db/client.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function inspect() {
  const sessionId = 'cmqqtrxug00010lnsarzqopfe';
  const events = await prisma.event.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' }
  });

  console.log('--- EVENTS FOR SESSION ---');
  console.log(events);
}

inspect();
