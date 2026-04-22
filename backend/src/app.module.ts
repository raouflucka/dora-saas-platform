import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FunctionsModule } from './functions/functions.module';
import { RiskAssessmentModule } from './risk-assessment/risk-assessment.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { PrismaModule } from './prisma/prisma.module';
import { FinancialEntitiesModule } from './financial-entities/financial-entities.module';
import { IctProvidersModule } from './ict-providers/ict-providers.module';
import { ReferenceModule } from './reference/reference.module';
import { ContractualArrangementsModule } from './contractual-arrangements/contractual-arrangements.module';
import { MailerModule } from './common/mailer/mailer.module';
import { IctServicesModule } from './ict-services/ict-services.module';
import { IctSupplyChainModule } from './ict-supply-chain/ict-supply-chain.module';
import { ExitStrategiesModule } from './exit-strategies/exit-strategies.module';
import { ValidationModule } from './validation/validation.module';
import { RoiExportModule } from './roi-export/roi-export.module';
import { TenantsModule } from './tenants/tenants.module';
import { RiskModule } from './risk/risk.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { ThrottlerModule } from '@nestjs/throttler';
import { CommentsModule } from './comments/comments.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ContractEntitiesModule } from './contract-entities/contract-entities.module';
import { ContractProvidersModule } from './contract-providers/contract-providers.module';
import { TenantIsolationMiddleware } from './common/middleware/tenant-isolation.middleware';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 10,
    }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    FunctionsModule,
    RiskAssessmentModule,
    AuditLogModule,
    FinancialEntitiesModule,
    IctProvidersModule,
    ReferenceModule,
    ContractualArrangementsModule,
    IctServicesModule,
    IctSupplyChainModule,
    ExitStrategiesModule,
    ValidationModule,
    RoiExportModule,
    TenantsModule,
    RiskModule,
    MailerModule,
    CommentsModule,
    DashboardModule,
    NotificationsModule,
    ContractEntitiesModule,
    ContractProvidersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global audit interceptor — DORA Art. 25 compliance
    // Fires on every successful POST/PATCH/PUT/DELETE across ALL controllers
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant isolation middleware to all routes after JWT decoding.
    // Sets PostgreSQL session variable app.current_tenant_id to activate RLS policies.
    consumer.apply(TenantIsolationMiddleware).forRoutes('*');
  }
}
