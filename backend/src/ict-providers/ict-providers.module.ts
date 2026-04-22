import { Module } from '@nestjs/common';
import { IctProvidersController } from './ict-providers.controller';
import { IctProvidersService } from './ict-providers.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [IctProvidersController],
  providers: [IctProvidersService, PrismaService],
})
export class IctProvidersModule {}
