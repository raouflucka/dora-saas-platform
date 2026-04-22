import { Module } from '@nestjs/common';
import { IctServicesService } from './ict-services.service';
import { IctServicesController } from './ict-services.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IctServicesController],
  providers: [IctServicesService],
  exports: [IctServicesService],
})
export class IctServicesModule {}
