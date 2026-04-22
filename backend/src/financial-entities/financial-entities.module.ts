import { Module } from '@nestjs/common';
import { FinancialEntitiesController } from './financial-entities.controller';
import { BranchesController } from './branches.controller';
import { FinancialEntitiesService } from './financial-entities.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [FinancialEntitiesController, BranchesController],
  providers: [FinancialEntitiesService, PrismaService],
})
export class FinancialEntitiesModule {}
