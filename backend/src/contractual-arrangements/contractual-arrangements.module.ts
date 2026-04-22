import { Module } from '@nestjs/common';
import { ContractualArrangementsService } from './contractual-arrangements.service';
import { ContractualArrangementsController } from './contractual-arrangements.controller';

@Module({
  providers: [ContractualArrangementsService],
  controllers: [ContractualArrangementsController]
})
export class ContractualArrangementsModule {}
