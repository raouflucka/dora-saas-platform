import { Module } from '@nestjs/common';
import { ExitStrategiesService } from './exit-strategies.service';
import { ExitStrategiesController } from './exit-strategies.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExitStrategiesController],
  providers: [ExitStrategiesService],
  exports: [ExitStrategiesService],
})
export class ExitStrategiesModule {}
