import { Module } from '@nestjs/common';
import { ContractProvidersService } from './contract-providers.service';
import { ContractProvidersController } from './contract-providers.controller';

@Module({
  controllers: [ContractProvidersController],
  providers: [ContractProvidersService],
  exports: [ContractProvidersService],
})
export class ContractProvidersModule {}
