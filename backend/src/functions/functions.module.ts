import { Module } from '@nestjs/common';
import { BusinessFunctionsService } from './functions.service';
import { BusinessFunctionsController } from './functions.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BusinessFunctionsController],
  providers: [BusinessFunctionsService],
  exports: [BusinessFunctionsService],
})
export class FunctionsModule {}
