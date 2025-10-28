// import pkg from '@prisma/client';
// const { PrismaClient } = pkg;
// ✅ Correct import path for your generated Prisma client
// import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaClient } from '@prisma/acquisition_db';

export const prismaClient = new PrismaClient();

try {
  await prismaClient.$connect();
  console.log('✅ Prisma connected to Neon database');
} catch (error) {
  console.error('❌ Prisma connection failed:', error);
  process.exit(1);
}
