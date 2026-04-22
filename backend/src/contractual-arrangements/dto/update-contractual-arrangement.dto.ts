import { PartialType } from '@nestjs/swagger';
import { CreateContractualArrangementDto } from './create-contractual-arrangement.dto';

export class UpdateContractualArrangementDto extends PartialType(CreateContractualArrangementDto) {}
