import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  try {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });
    console.log("Prisma client instantiated!");
    await prisma.$connect();
    console.log("Prisma connected!!");
  } catch(e) {
    console.error("ERROR::", e);
  } finally {
    process.exit(0);
  }
}
main();
