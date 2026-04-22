import { PartialType } from '@nestjs/swagger';
import { CreateIctServiceDto } from './create-ict-service.dto';

export class UpdateIctServiceDto extends PartialType(CreateIctServiceDto) {}
