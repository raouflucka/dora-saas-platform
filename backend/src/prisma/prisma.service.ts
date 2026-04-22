import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:1234@localhost:5432/DORA_DB?schema=public';
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool as any);
    super({ adapter, log: ['error', 'warn'] });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    // Process graceful shutdown is handled mostly by Nest
  }
}
