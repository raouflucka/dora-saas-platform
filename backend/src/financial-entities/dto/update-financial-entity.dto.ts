import { PartialType } from '@nestjs/swagger';
import { CreateFinancialEntityDto } from './create-financial-entity.dto';

export class UpdateFinancialEntityDto extends PartialType(CreateFinancialEntityDto) {}
