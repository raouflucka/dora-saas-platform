import { PartialType } from '@nestjs/swagger';
import { CreateExitStrategyDto } from './create-exit-strategy.dto';

export class UpdateExitStrategyDto extends PartialType(CreateExitStrategyDto) {}
