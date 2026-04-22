import { PartialType } from '@nestjs/swagger';
import { CreateBusinessFunctionDto } from './create-business-function.dto';

export class UpdateBusinessFunctionDto extends PartialType(CreateBusinessFunctionDto) {}
