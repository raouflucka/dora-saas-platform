import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';

@Injectable()
export class RiskAssessmentService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveContract(contractId: string, tenantId: string) {
    const contract = await this.prisma.contractualArrangement.findFirst({
      where: { id: contractId, tenantId },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found or access denied');
    }
    return contract;
  }

  async create(tenantId: string, dto: CreateAssessmentDto) {
    await this.resolveContract(dto.contractId, tenantId);

    return this.prisma.ictServiceAssessment.create({
      data: {
        tenantId,
        contractId:                   dto.contractId,
        providerId:                   dto.providerId,
        isSubstitutable:              dto.isSubstitutable,
        substitutionReason:           dto.substitutionReason,
        alternativeProvidersExist:    dto.alternativeProvidersExist,
        alternativeProviderReference: dto.alternativeProviderReference,
        discontinuationImpact:        dto.discontinuationImpact,
        exitPlanExists:               dto.exitPlanExists,
        reintegrationPossible:        dto.reintegrationPossible,
        lastAuditDate:   dto.lastAuditDate   ? new Date(dto.lastAuditDate)   : undefined,
        nextReviewDate:  dto.nextReviewDate  ? new Date(dto.nextReviewDate)  : undefined,
        triggerReason:   dto.triggerReason   ?? 'MANUAL_REVIEW',
        assessmentStatus: dto.assessmentStatus ?? 'ACTIVE',
      },
      include: {
        contract: { include: { financialEntity: true, ictServiceType: true } },
        provider: true,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.ictServiceAssessment.findMany({
      where: {
        tenantId,
        contract: { tenantId },
      },
      include: {
        contract: { include: { financialEntity: true, ictServiceType: true } },
        provider: true,
      },
      orderBy: [
        { assessmentStatus: 'asc' },   // ACTIVE first
        { createdAt: 'desc' },          // newest first within status
      ],
    });
  }

  async findOne(id: string, tenantId: string) {
    const record = await this.prisma.ictServiceAssessment.findFirst({
      where: {
        id,
        tenantId,
        contract: { tenantId },
      },
      include: {
        contract: {
          include: {
            financialEntity: true,
            ictServiceType:  true,
            relianceLevel:   true,
          },
        },
        provider: true,
      },
    });
    if (!record) {
      throw new NotFoundException(`ICT Service Assessment ${id} not found`);
    }
    return record;
  }

  async update(id: string, tenantId: string, dto: UpdateAssessmentDto) {
    await this.findOne(id, tenantId);

    return this.prisma.ictServiceAssessment.update({
      where: { id },
      data: {
        ...dto,
        lastAuditDate:  dto.lastAuditDate  ? new Date(dto.lastAuditDate)  : undefined,
        nextReviewDate: dto.nextReviewDate ? new Date(dto.nextReviewDate) : undefined,
        // Prevent contractId / providerId from being changed after creation
        contractId: undefined,
        providerId: undefined,
      },
      include: {
        contract: { include: { financialEntity: true, ictServiceType: true } },
        provider: true,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.ictServiceAssessment.delete({ where: { id } });
  }
}
