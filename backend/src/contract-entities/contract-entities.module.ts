import { Module } from '@nestjs/common';
import { ContractEntitiesService } from './contract-entities.service';
import { ContractEntitiesController } from './contract-entities.controller';

@Module({
  controllers: [ContractEntitiesController],
  providers: [ContractEntitiesService],
  exports: [ContractEntitiesService],
})
export class ContractEntitiesModule {}
