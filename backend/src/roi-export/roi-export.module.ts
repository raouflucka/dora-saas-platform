import { Module } from '@nestjs/common';
import { RoiExportController } from './roi-export.controller';
import { RoiExportService } from './roi-export.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [PrismaModule, RiskModule],
  controllers: [RoiExportController],
  providers: [RoiExportService],
})
export class RoiExportModule {}
