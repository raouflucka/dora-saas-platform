import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(tenantId: string) {
    const [totalEntities, totalProviders, totalContracts, totalServices] = await Promise.all([
      this.prisma.financialEntity.count({ where: { tenantId } }),
      this.prisma.ictProvider.count({ where: { tenantId } }),
      this.prisma.contractualArrangement.count({ where: { tenantId } }),
      this.prisma.ictService.count({ where: { tenantId } }),
    ]);

    // Smart Insights: Missing LEIs — catch both null and empty string
    const providersWithoutLEI = await this.prisma.ictProvider.findMany({
      where: {
        tenantId,
        OR: [{ lei: null }, { lei: '' }],
      },
      select: { id: true, legalName: true }
    });

    // Smart Insights: Expiring Contracts
    const contractsEndingSoon = await this.prisma.contractualArrangement.findMany({
      where: {
        tenantId,
        endDate: { gte: new Date(), lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) }
      },
      select: { id: true, contractReference: true, endDate: true, provider: { select: { legalName: true } } }
    });

    // Latest validation run summary
    const latestRun = await this.prisma.validationRun.findFirst({
      where: { tenantId },
      orderBy: { executedAt: 'desc' },
    });

    // Derive flagged/waiting counts from JSON results
    let flaggedIssues = 0;
    let openErrors = latestRun?.totalErrors ?? 0;
    let waitingApproval = 0;
    if (latestRun?.results) {
      const results = latestRun.results as Array<{ status?: string; severity?: string }>;
      flaggedIssues = results.filter(r => r.status === 'FLAGGED').length;
      waitingApproval = results.filter(r => r.status === 'WAITING_APPROVAL').length;
      // openErrors = only truly unresolved errors (OPEN + FLAGGED).
      // WAITING_APPROVAL = Editor submitted a fix, pending Analyst review — NOT a blocking error.
      // RESOLVED / FIXED = permanently closed — not counted.
      openErrors = results.filter(
        r => r.severity === 'ERROR'
          && r.status !== 'FIXED'
          && r.status !== 'RESOLVED'
          && r.status !== 'WAITING_APPROVAL'
      ).length;
    }

    // Supply chain concentration: providers with > 1 contract (concentration risk)
    const allContracts = await this.prisma.contractualArrangement.findMany({
      where: { tenantId },
      select: { providerId: true, provider: { select: { legalName: true } } }
    });
    const providerContractCount: Record<string, { name: string; count: number }> = {};
    for (const c of allContracts) {
      if (!c.providerId) continue;
      if (!providerContractCount[c.providerId]) {
        providerContractCount[c.providerId] = { name: c.provider?.legalName || c.providerId, count: 0 };
      }
      providerContractCount[c.providerId].count++;
    }
    const concentrationRisks = Object.entries(providerContractCount)
      .filter(([, v]) => v.count > 1)
      .map(([id, v]) => ({ providerId: id, providerName: v.name, contractCount: v.count }))
      .sort((a, b) => b.contractCount - a.contractCount)
      .slice(0, 5);

    // Derive an overall risk score (0–100)
    let riskScore = 100;
    if (openErrors > 0) riskScore -= Math.min(openErrors * 5, 40);
    if (providersWithoutLEI.length > 0) riskScore -= Math.min(providersWithoutLEI.length * 3, 20);
    if (contractsEndingSoon.length > 0) riskScore -= Math.min(contractsEndingSoon.length * 2, 15);
    if (concentrationRisks.length > 0) riskScore -= Math.min(concentrationRisks.length * 3, 15);
    riskScore = Math.max(0, riskScore);

    return {
      metrics: {
        entities: totalEntities,
        providers: totalProviders,
        contracts: totalContracts,
        services: totalServices,
      },
      insights: {
        providersMissingLEI: providersWithoutLEI.length,
        contractsEndingSoon: contractsEndingSoon.length,
        missingLEIDetails: providersWithoutLEI,
        expiringContractsDetails: contractsEndingSoon,
      },
      validation: {
        latestRunId: latestRun?.id ?? null,
        executedAt: latestRun?.executedAt?.toISOString() ?? null,
        totalErrors: openErrors,
        totalWarnings: latestRun?.totalWarnings ?? 0,
        flaggedIssues,
        isExportReady: openErrors === 0 && !!latestRun,
      },
      risk: {
        score: riskScore,
        concentrationRisks,
      }
    };
  }
}
