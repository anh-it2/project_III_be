import { PrismaClient } from '@prisma/client';

// One client for the whole app. Creating many leaks DB connections.
export const prisma = new PrismaClient();
