import { Module } from '@nestjs/common';
import { IctSupplyChainService } from './ict-supply-chain.service';
import { IctSupplyChainController } from './ict-supply-chain.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IctSupplyChainController],
  providers: [IctSupplyChainService],
  exports: [IctSupplyChainService],
})
export class IctSupplyChainModule {}
