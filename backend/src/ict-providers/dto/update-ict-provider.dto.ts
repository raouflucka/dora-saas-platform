import { PartialType } from '@nestjs/swagger';
import { CreateIctProviderDto } from './create-ict-provider.dto';

export class UpdateIctProviderDto extends PartialType(CreateIctProviderDto) {}
