import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ConcentrationRiskItem {
  providerId: string;
  providerName: string;
  providerLei: string | null;
  contractCount: number;
  percentageShare: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface GeographicRiskItem {
  countryCode: string;
  countryName: string;
  contractCount: number;
  percentageShare: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

@Injectable()
export class RiskService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Concentration Risk Analysis — DORA Art. 28§5 / EBA RT.09
   * Identifies providers with a dominant share of contracts.
   * Thresholds: HIGH ≥ 33%, MEDIUM ≥ 20%, LOW < 20%
   */
  async getConcentrationRisk(tenantId: string): Promise<{
    totalContracts: number;
    riskItems: ConcentrationRiskItem[];
    dominantProviders: number;
    summary: string;
  }> {
    const contracts = await this.prisma.contractualArrangement.findMany({
      where: { tenantId },
      select: { providerId: true },
    });

    const totalContracts = contracts.length;

    if (totalContracts === 0) {
      return {
        totalContracts: 0,
        riskItems: [],
        dominantProviders: 0,
        summary: 'No contractual arrangements found. Add contracts to analyse concentration risk.',
      };
    }

    // Count contracts per provider
    const countMap = new Map<string, number>();
    for (const c of contracts) {
      countMap.set(c.providerId, (countMap.get(c.providerId) ?? 0) + 1);
    }

    // Enrich with provider details
    const providerIds = Array.from(countMap.keys());
    const providers = await this.prisma.ictProvider.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, legalName: true, lei: true },
    });
    const providerMap = new Map(providers.map(p => [p.id, p]));

    const riskItems: ConcentrationRiskItem[] = Array.from(countMap.entries())
      .map(([providerId, contractCount]) => {
        const provider = providerMap.get(providerId);
        const percentageShare = Math.round((contractCount / totalContracts) * 10000) / 100;
        const riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' =
          percentageShare >= 33 ? 'HIGH' :
          percentageShare >= 20 ? 'MEDIUM' : 'LOW';

        return {
          providerId,
          providerName: provider?.legalName || 'Unknown Provider',
          providerLei: provider?.lei || null,
          contractCount,
          percentageShare,
          riskLevel,
        };
      })
      .sort((a, b) => b.percentageShare - a.percentageShare); // Highest risk first

    const dominantProviders = riskItems.filter(r => r.riskLevel === 'HIGH').length;

    const summary = dominantProviders > 0
      ? `⚠ ${dominantProviders} provider(s) hold ≥33% of contracts — concentration risk flagged (DORA Art. 28§5).`
      : riskItems.some(r => r.riskLevel === 'MEDIUM')
        ? 'Moderate concentration detected. Review providers with ≥20% contract share.'
        : 'Concentration risk is within acceptable thresholds.';

    return { totalContracts, riskItems, dominantProviders, summary };
  }

  /**
   * Geographic Concentration Risk Analysis — DORA Art. 29
   * Identifies systemic risk from geographic concentration of services.
   * Thresholds: HIGH ≥ 40%, MEDIUM ≥ 25%, LOW < 25%
   */
  async getGeographicRisk(tenantId: string): Promise<{
    totalContracts: number;
    riskItems: GeographicRiskItem[];
    highRiskCountries: number;
    summary: string;
  }> {
    const contracts = await this.prisma.contractualArrangement.findMany({
      where: { tenantId },
      select: { serviceCountry: true, serviceCountryRef: { select: { name: true } } },
    });

    const totalContracts = contracts.length;

    if (totalContracts === 0) {
      return {
        totalContracts: 0,
        riskItems: [],
        highRiskCountries: 0,
        summary: 'No geographic data available. Add contracts with service country defined.',
      };
    }

    const countMap = new Map<string, { count: number; name: string }>();
    let unspecifiedCount = 0;

    for (const c of contracts) {
      if (!c.serviceCountry) {
        unspecifiedCount++;
        continue;
      }
      const existing = countMap.get(c.serviceCountry) || { count: 0, name: c.serviceCountryRef?.name || c.serviceCountry };
      existing.count += 1;
      countMap.set(c.serviceCountry, existing);
    }

    const validTotal = totalContracts - unspecifiedCount;
    if (validTotal === 0) {
       return {
         totalContracts,
         riskItems: [],
         highRiskCountries: 0,
         summary: `${unspecifiedCount} contracts have unspecified geography. Location risk cannot be mapped.`,
       };
    }

    const riskItems: GeographicRiskItem[] = Array.from(countMap.entries())
      .map(([countryCode, data]) => {
        const percentageShare = Math.round((data.count / validTotal) * 10000) / 100;
        const riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' =
          percentageShare >= 40 ? 'HIGH' :
          percentageShare >= 25 ? 'MEDIUM' : 'LOW';

        return {
          countryCode,
          countryName: data.name,
          contractCount: data.count,
          percentageShare,
          riskLevel,
        };
      })
      .sort((a, b) => b.percentageShare - a.percentageShare);

    const highRiskCountries = riskItems.filter(r => r.riskLevel === 'HIGH').length;

    const summary = highRiskCountries > 0
      ? `⚠ ${highRiskCountries} countr(ies) hold ≥40% of operations — systemic geographic risk flagged.`
      : riskItems.some(r => r.riskLevel === 'MEDIUM')
        ? 'Moderate geographic concentration detected outside diversification limits.'
        : 'Geographic distribution is well diversified.';

    // Append a warning about missing data if significant
    const finalSummary = unspecifiedCount > 0 
      ? `${summary} (Note: ${unspecifiedCount} contracts lack geographic data)` 
      : summary;

    return { totalContracts, riskItems, highRiskCountries, summary: finalSummary };
  }
}
