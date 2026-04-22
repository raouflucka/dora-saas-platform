import { PartialType } from '@nestjs/swagger';
import { CreateSupplyChainDto } from './create-supply-chain.dto';

export class UpdateSupplyChainDto extends PartialType(CreateSupplyChainDto) {}
