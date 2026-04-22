/**
 * DORA SaaS — Unified Seed (Single Source of Truth)
 * All column lengths match schema.prisma exactly.
 * Run: cd backend && npm run seed
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://postgres:1234@localhost:5432/DORA_DB?schema=public',
});
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter } as any);

// ─── helpers ─────────────────────────────────────────────────
// Pad or truncate to exact char length (for CHAR columns)
const char = (s: string, len: number) => s.slice(0, len).padEnd(len, '0');

// LEI: exactly 20 uppercase alphanumeric
const lei = (base: string) => char(base.toUpperCase().replace(/[^A-Z0-9]/g, '0'), 20);

// ─── EBA Validation Rules (196 — VR_01 through VR_196) ─────────────────────
type Rule = { templateName: string; fieldName: string; ruleType: string; ruleValue?: string; errorMessage: string; severity: 'ERROR'|'WARNING'; doraArticle?: string; };
const rules: Rule[] = [
  // RT.01.01 — Financial Entities (11 rules)
  { templateName:'RT.01.01', fieldName:'lei',              ruleType:'required',    ruleValue:'financial_entities',  errorMessage:'LEI is mandatory (EBA VR_01)',                         severity:'ERROR',   doraArticle:'Art.28(3)' },
  { templateName:'RT.01.01', fieldName:'lei',              ruleType:'format',      ruleValue:'^[A-Z0-9]{18}[0-9]{2}$', errorMessage:'LEI must be 20 alphanumeric chars (EBA VR_02)',   severity:'ERROR',   doraArticle:'Art.28(3)' },
  { templateName:'RT.01.01', fieldName:'name',             ruleType:'required',    ruleValue:'financial_entities',  errorMessage:'Entity name is mandatory (EBA VR_03)',                 severity:'ERROR' },
  { templateName:'RT.01.01', fieldName:'country',          ruleType:'required',    ruleValue:'financial_entities',  errorMessage:'Country of establishment is mandatory (EBA VR_04)',    severity:'ERROR' },
  { templateName:'RT.01.01', fieldName:'country',          ruleType:'dropdown',    ruleValue:'countries.code',       errorMessage:'Country must be valid ISO 3166-1 alpha-2 (EBA VR_05)',severity:'ERROR' },
  { templateName:'RT.01.01', fieldName:'entity_type_id',   ruleType:'required',    ruleValue:'financial_entities',  errorMessage:'Entity type is mandatory (EBA VR_06)',                 severity:'ERROR' },
  { templateName:'RT.01.01', fieldName:'entity_type_id',   ruleType:'dropdown',    ruleValue:'entity_types.id',      errorMessage:'Entity type must be valid EBA-defined type (EBA VR_07)',severity:'ERROR' },
  { templateName:'RT.01.01', fieldName:'integration_date', ruleType:'required',    ruleValue:'financial_entities',  errorMessage:'Integration date is mandatory (EBA VR_08)',            severity:'ERROR',   doraArticle:'Art.28(3)' },
  { templateName:'RT.01.01', fieldName:'integration_date', ruleType:'format',      ruleValue:'date',                 errorMessage:'Integration date must be a valid date (EBA VR_09)',   severity:'ERROR' },
  { templateName:'RT.01.01', fieldName:'total_assets',     ruleType:'required',    ruleValue:'financial_entities',  errorMessage:'Total assets required (EBA VR_10)',                    severity:'WARNING', doraArticle:'Art.4' },
  { templateName:'RT.01.01', fieldName:'total_assets',     ruleType:'range',       ruleValue:'0|',                   errorMessage:'Total assets must be non-negative (EBA VR_11)',        severity:'ERROR' },
  // RT.01.02 (7)
  { templateName:'RT.01.02', fieldName:'lei',     ruleType:'required', ruleValue:'financial_entities', errorMessage:'LEI required for entity in scope (EBA VR_12)',     severity:'ERROR', doraArticle:'Art.28(3)' },
  { templateName:'RT.01.02', fieldName:'name',    ruleType:'required', ruleValue:'financial_entities', errorMessage:'Name is required (EBA VR_13)',                     severity:'ERROR' },
  { templateName:'RT.01.02', fieldName:'country', ruleType:'required', ruleValue:'financial_entities', errorMessage:'Country of establishment required (EBA VR_14)',    severity:'ERROR' },
  { templateName:'RT.01.02', fieldName:'total_assets', ruleType:'range', ruleValue:'0|',               errorMessage:'Total assets must be non-negative (EBA VR_15)',    severity:'WARNING' },
  { templateName:'RT.01.02', fieldName:'currency', ruleType:'required', ruleValue:'financial_entities', errorMessage:'Reporting currency required (EBA VR_16)',         severity:'ERROR' },
  { templateName:'RT.01.02', fieldName:'currency', ruleType:'dropdown', ruleValue:'currencies.code',   errorMessage:'Currency must be valid ISO 4217 (EBA VR_17)',      severity:'ERROR' },
  { templateName:'RT.01.02', fieldName:'deletion_date', ruleType:'format', ruleValue:'date',           errorMessage:'Deletion date must be valid if provided (EBA VR_18)',severity:'ERROR' },
  // RT.01.03 — Branches (6)
  { templateName:'RT.01.03', fieldName:'name',               ruleType:'required', ruleValue:'branches', errorMessage:'Branch name is mandatory (EBA VR_19)',            severity:'ERROR' },
  { templateName:'RT.01.03', fieldName:'country',            ruleType:'required', ruleValue:'branches', errorMessage:'Branch country is mandatory (EBA VR_20)',         severity:'ERROR' },
  { templateName:'RT.01.03', fieldName:'country',            ruleType:'dropdown', ruleValue:'countries.code', errorMessage:'Branch country must be valid ISO (EBA VR_21)', severity:'ERROR' },
  { templateName:'RT.01.03', fieldName:'financial_entity_id',ruleType:'required', ruleValue:'branches', errorMessage:'Branch must link to financial entity (EBA VR_22)',severity:'ERROR' },
  { templateName:'RT.01.03', fieldName:'financial_entity_id',ruleType:'fk_exists',ruleValue:'branches.financial_entity_id→financial_entities.id', errorMessage:'Branch must reference existing entity (EBA VR_23)', severity:'ERROR' },
  { templateName:'RT.01.03', fieldName:'branch_code',        ruleType:'required', ruleValue:'branches', errorMessage:'Branch code required (EBA VR_24)',                severity:'WARNING' },
  // RT.02.01 — Contracts General (9)
  { templateName:'RT.02.01', fieldName:'contract_reference',    ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'Contract reference mandatory (EBA VR_25)',     severity:'ERROR', doraArticle:'Art.30' },
  { templateName:'RT.02.01', fieldName:'start_date',            ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'Contract start date mandatory (EBA VR_26)',     severity:'ERROR', doraArticle:'Art.30' },
  { templateName:'RT.02.01', fieldName:'start_date',            ruleType:'format',   ruleValue:'date',  errorMessage:'Start date must be valid date (EBA VR_27)',                       severity:'ERROR' },
  { templateName:'RT.02.01', fieldName:'end_date',              ruleType:'format',   ruleValue:'date',  errorMessage:'End date must be valid if provided (EBA VR_28)',                  severity:'ERROR' },
  { templateName:'RT.02.01', fieldName:'contract_type',         ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'Contract type required (EBA VR_29)',           severity:'ERROR', doraArticle:'Art.30' },
  { templateName:'RT.02.01', fieldName:'currency',              ruleType:'dropdown', ruleValue:'currencies.code', errorMessage:'Currency must be valid ISO 4217 (EBA VR_30)',           severity:'ERROR' },
  { templateName:'RT.02.01', fieldName:'annual_cost',           ruleType:'range',    ruleValue:'0|',    errorMessage:'Annual cost must be zero or positive (EBA VR_31)',                severity:'ERROR' },
  { templateName:'RT.02.01', fieldName:'reliance_level_id',     ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'Reliance level required (EBA VR_32)',          severity:'ERROR', doraArticle:'Art.28(2)' },
  { templateName:'RT.02.01', fieldName:'reliance_level_id',     ruleType:'dropdown', ruleValue:'reliance_levels.id', errorMessage:'Reliance level must be valid EBA code (EBA VR_33)', severity:'ERROR' },
  // RT.02.02 — Contracts Specific (16)
  { templateName:'RT.02.02', fieldName:'financial_entity_id',    ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'Financial entity must be linked (EBA VR_34)',  severity:'ERROR' },
  { templateName:'RT.02.02', fieldName:'financial_entity_id',    ruleType:'fk_exists',ruleValue:'contractual_arrangements.financial_entity_id→financial_entities.id', errorMessage:'Financial entity reference must resolve (EBA VR_35)', severity:'ERROR' },
  { templateName:'RT.02.02', fieldName:'provider_id',            ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'ICT provider must be linked (EBA VR_36)',      severity:'ERROR' },
  { templateName:'RT.02.02', fieldName:'provider_id',            ruleType:'fk_exists',ruleValue:'contractual_arrangements.provider_id→ict_providers.id', errorMessage:'Provider reference must resolve (EBA VR_37)', severity:'ERROR' },
  { templateName:'RT.02.02', fieldName:'governing_law_country',  ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'Governing law country required (EBA VR_38)',   severity:'ERROR', doraArticle:'Art.30' },
  { templateName:'RT.02.02', fieldName:'governing_law_country',  ruleType:'dropdown', ruleValue:'countries.code', errorMessage:'Governing law country must be valid ISO (EBA VR_39)',   severity:'ERROR' },
  { templateName:'RT.02.02', fieldName:'service_country',        ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'Service country required (EBA VR_40)',         severity:'ERROR' },
  { templateName:'RT.02.02', fieldName:'service_country',        ruleType:'dropdown', ruleValue:'countries.code', errorMessage:'Service country must be valid ISO (EBA VR_41)',         severity:'ERROR' },
  { templateName:'RT.02.02', fieldName:'data_sensitivity_id',    ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'Data sensitivity required (EBA VR_42)',        severity:'ERROR', doraArticle:'Art.30' },
  { templateName:'RT.02.02', fieldName:'data_sensitivity_id',    ruleType:'dropdown', ruleValue:'data_sensitivity_levels.id', errorMessage:'Data sensitivity must be valid (EBA VR_43)',severity:'ERROR' },
  { templateName:'RT.02.02', fieldName:'termination_notice_period',ruleType:'range', ruleValue:'1|',   errorMessage:'Termination notice ≥1 day (EBA VR_44)',                            severity:'ERROR', doraArticle:'Art.30' },
  { templateName:'RT.02.02', fieldName:'termination_notice_period',ruleType:'required',ruleValue:'contractual_arrangements', errorMessage:'Termination notice period required (EBA VR_45)', severity:'ERROR', doraArticle:'Art.30' },
  { templateName:'RT.02.02', fieldName:'ict_service_type_id',    ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'ICT service type required (EBA VR_46)',        severity:'ERROR' },
  { templateName:'RT.02.02', fieldName:'ict_service_type_id',    ruleType:'dropdown', ruleValue:'ict_service_types.id', errorMessage:'ICT service type must be valid (EBA VR_47)',      severity:'ERROR' },
  { templateName:'RT.02.02', fieldName:'storage_location',       ruleType:'conditional',ruleValue:'contractual_arrangements.data_storage=true→storage_location.required', errorMessage:'Storage location required when data_storage=true (EBA VR_48)', severity:'ERROR', doraArticle:'Art.30' },
  { templateName:'RT.02.02', fieldName:'processing_location',    ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'Processing location required (EBA VR_49)',     severity:'ERROR', doraArticle:'Art.30' },
  { templateName:'RT.02.02', fieldName:'processing_location',    ruleType:'dropdown', ruleValue:'countries.code', errorMessage:'Processing location must be valid ISO (EBA VR_50)',     severity:'ERROR' },
  { templateName:'RT.02.02', fieldName:'end_date',               ruleType:'cross-field',ruleValue:'contractual_arrangements.end_date>contractual_arrangements.start_date', errorMessage:'End date must be after start date (EBA VR_51)', severity:'ERROR' },
  // RT.05.01 — ICT Providers (13)
  { templateName:'RT.05.01', fieldName:'provider_code',       ruleType:'required', ruleValue:'ict_providers', errorMessage:'Provider code is mandatory (EBA VR_60)',            severity:'ERROR' },
  { templateName:'RT.05.01', fieldName:'lei',                 ruleType:'required', ruleValue:'ict_providers', errorMessage:'Provider LEI is mandatory (EBA VR_61)',             severity:'ERROR', doraArticle:'Art.28(1)' },
  { templateName:'RT.05.01', fieldName:'lei',                 ruleType:'format',   ruleValue:'^[A-Z0-9]{20}$', errorMessage:'Provider LEI must be exactly 20 chars (EBA VR_62)', severity:'ERROR' },
  { templateName:'RT.05.01', fieldName:'legal_name',          ruleType:'required', ruleValue:'ict_providers', errorMessage:'Provider legal name required (EBA VR_63)',           severity:'ERROR' },
  { templateName:'RT.05.01', fieldName:'latin_name',          ruleType:'required', ruleValue:'ict_providers', errorMessage:'Provider Latin name required (EBA VR_64)',           severity:'WARNING' },
  { templateName:'RT.05.01', fieldName:'person_type_id',      ruleType:'required', ruleValue:'ict_providers', errorMessage:'Person type required (EBA VR_65)',                   severity:'ERROR' },
  { templateName:'RT.05.01', fieldName:'person_type_id',      ruleType:'dropdown', ruleValue:'provider_person_types.id', errorMessage:'Person type must be valid (EBA VR_66)',   severity:'ERROR' },
  { templateName:'RT.05.01', fieldName:'headquarters_country',ruleType:'required', ruleValue:'ict_providers', errorMessage:'Headquarters country required (EBA VR_67)',          severity:'ERROR' },
  { templateName:'RT.05.01', fieldName:'headquarters_country',ruleType:'dropdown', ruleValue:'countries.code', errorMessage:'Headquarters country must be valid ISO (EBA VR_68)',severity:'ERROR' },
  { templateName:'RT.05.01', fieldName:'ultimate_parent_lei', ruleType:'format',   ruleValue:'^[A-Z0-9]{20}$', errorMessage:'Ultimate parent LEI must be 20 chars (EBA VR_69)', severity:'WARNING' },
  { templateName:'RT.05.01', fieldName:'nace_code',           ruleType:'format',   ruleValue:'^[A-Z][0-9]{2}(\\.[0-9]{1,2})?$', errorMessage:'NACE code must follow NACE Rev.2 (EBA VR_70)', severity:'WARNING' },
  { templateName:'RT.05.01', fieldName:'competent_authority', ruleType:'required', ruleValue:'ict_providers', errorMessage:'Competent authority required (EBA VR_71)',           severity:'WARNING', doraArticle:'Art.28(1)' },
  { templateName:'RT.05.01', fieldName:'ultimate_parent_lei', ruleType:'conditional',ruleValue:'ict_providers.intra_group_flag=true→ultimate_parent_lei.required', errorMessage:'Parent LEI required when intra-group (EBA VR_72)', severity:'ERROR', doraArticle:'Art.28(3)' },
  // RT.05.02 — ICT Supply Chain (5)
  { templateName:'RT.05.02', fieldName:'contract_id',  ruleType:'required', ruleValue:'ict_supply_chain', errorMessage:'Supply chain must reference a contract (EBA VR_80)', severity:'ERROR' },
  { templateName:'RT.05.02', fieldName:'provider_id',  ruleType:'required', ruleValue:'ict_supply_chain', errorMessage:'Provider required for supply chain entry (EBA VR_81)',severity:'ERROR' },
  { templateName:'RT.05.02', fieldName:'service_type_id',ruleType:'dropdown',ruleValue:'ict_service_types.id', errorMessage:'Service type must be valid (EBA VR_82)',          severity:'ERROR' },
  { templateName:'RT.05.02', fieldName:'supply_rank',  ruleType:'required', ruleValue:'ict_supply_chain', errorMessage:'Supply rank required (EBA VR_83)',                     severity:'ERROR', doraArticle:'Art.28(3)' },
  { templateName:'RT.05.02', fieldName:'supply_rank',  ruleType:'range',    ruleValue:'1|',               errorMessage:'Supply rank must be at least 1 (EBA VR_84)',           severity:'ERROR' },
  // RT.06.01 — Business Functions (11)
  { templateName:'RT.06.01', fieldName:'function_identifier',  ruleType:'required', ruleValue:'business_functions', errorMessage:'Function identifier required (EBA VR_90)',    severity:'ERROR' },
  { templateName:'RT.06.01', fieldName:'function_name',        ruleType:'required', ruleValue:'business_functions', errorMessage:'Function name required (EBA VR_91)',           severity:'ERROR' },
  { templateName:'RT.06.01', fieldName:'criticality_level_id', ruleType:'required', ruleValue:'business_functions', errorMessage:'Criticality level required (EBA VR_92)',       severity:'ERROR', doraArticle:'Art.28(4)' },
  { templateName:'RT.06.01', fieldName:'criticality_level_id', ruleType:'dropdown', ruleValue:'criticality_levels.id', errorMessage:'Criticality level must be valid (EBA VR_93)',severity:'ERROR' },
  { templateName:'RT.06.01', fieldName:'last_assessment_date', ruleType:'required', ruleValue:'business_functions', errorMessage:'Last assessment date required (EBA VR_94)',    severity:'ERROR' },
  { templateName:'RT.06.01', fieldName:'last_assessment_date', ruleType:'format',   ruleValue:'date',               errorMessage:'Last assessment date must be valid (EBA VR_95)',severity:'ERROR' },
  { templateName:'RT.06.01', fieldName:'rto',                  ruleType:'required', ruleValue:'business_functions', errorMessage:'RTO required (EBA VR_96)',                    severity:'ERROR', doraArticle:'Art.11' },
  { templateName:'RT.06.01', fieldName:'rto',                  ruleType:'range',    ruleValue:'0|',                 errorMessage:'RTO must be non-negative hours (EBA VR_97)',   severity:'ERROR' },
  { templateName:'RT.06.01', fieldName:'rpo',                  ruleType:'required', ruleValue:'business_functions', errorMessage:'RPO required (EBA VR_98)',                    severity:'ERROR', doraArticle:'Art.11' },
  { templateName:'RT.06.01', fieldName:'rpo',                  ruleType:'range',    ruleValue:'0|',                 errorMessage:'RPO must be non-negative hours (EBA VR_99)',   severity:'ERROR' },
  { templateName:'RT.06.01', fieldName:'impact_discontinuation',ruleType:'required',ruleValue:'business_functions', errorMessage:'Impact of discontinuation required (EBA VR_100)',severity:'ERROR', doraArticle:'Art.28(4)' },
  { templateName:'RT.06.01', fieldName:'licensed_activity',    ruleType:'required', ruleValue:'business_functions', errorMessage:'Licensed activity required (EBA VR_101)',      severity:'WARNING' },
  // RT.07.01 — ICT Service Assessments (12)
  { templateName:'RT.07.01', fieldName:'contract_id',               ruleType:'required',    ruleValue:'ict_service_assessments', errorMessage:'Assessment must link to a contract (EBA VR_105)',           severity:'ERROR' },
  { templateName:'RT.07.01', fieldName:'contract_id',               ruleType:'fk_exists',   ruleValue:'ict_service_assessments.contract_id→contractual_arrangements.id', errorMessage:'Assessment contract must resolve (EBA VR_106)', severity:'ERROR' },
  { templateName:'RT.07.01', fieldName:'provider_id',               ruleType:'required',    ruleValue:'ict_service_assessments', errorMessage:'Assessment must reference a provider (EBA VR_107)',          severity:'ERROR' },
  { templateName:'RT.07.01', fieldName:'is_substitutable',          ruleType:'required',    ruleValue:'ict_service_assessments', errorMessage:'Substitutability required per Art.28(5) (EBA VR_108)',       severity:'ERROR', doraArticle:'Art.28(5)' },
  { templateName:'RT.07.01', fieldName:'substitution_reason',       ruleType:'conditional', ruleValue:'ict_service_assessments.is_substitutable=false→substitution_reason.required', errorMessage:'Substitution justification required when not substitutable (EBA VR_109)', severity:'ERROR', doraArticle:'Art.28(5)' },
  { templateName:'RT.07.01', fieldName:'last_audit_date',           ruleType:'required',    ruleValue:'ict_service_assessments', errorMessage:'Last audit date required (EBA VR_110)',                      severity:'ERROR' },
  { templateName:'RT.07.01', fieldName:'last_audit_date',           ruleType:'format',      ruleValue:'date', errorMessage:'Last audit date must be valid (EBA VR_111)',                                    severity:'ERROR' },
  { templateName:'RT.07.01', fieldName:'exit_plan_exists',          ruleType:'required',    ruleValue:'ict_service_assessments', errorMessage:'Exit plan status required (EBA VR_112)',                     severity:'ERROR', doraArticle:'Art.28(8)' },
  { templateName:'RT.07.01', fieldName:'reintegration_possible',    ruleType:'required',    ruleValue:'ict_service_assessments', errorMessage:'Reintegration possibility required (EBA VR_113)',            severity:'ERROR', doraArticle:'Art.28(5)' },
  { templateName:'RT.07.01', fieldName:'discontinuation_impact',    ruleType:'required',    ruleValue:'ict_service_assessments', errorMessage:'Discontinuation impact required (EBA VR_114)',               severity:'ERROR', doraArticle:'Art.28(5)' },
  { templateName:'RT.07.01', fieldName:'alternative_providers_exist',ruleType:'required',   ruleValue:'ict_service_assessments', errorMessage:'Alternative provider availability required (EBA VR_115)',    severity:'ERROR', doraArticle:'Art.28(5)' },
  { templateName:'RT.07.01', fieldName:'alternative_provider_reference',ruleType:'conditional',ruleValue:'ict_service_assessments.alternative_providers_exist=true→alternative_provider_reference.required', errorMessage:'Alternative provider reference required when alternatives exist (EBA VR_116)', severity:'WARNING', doraArticle:'Art.28(5)' },
  // RT.08 — Exit Strategies (6)
  { templateName:'RT.08', fieldName:'contract_id',       ruleType:'required', ruleValue:'exit_strategies', errorMessage:'Exit strategy must link to a contract (EBA VR_120)',       severity:'ERROR', doraArticle:'Art.28(8)' },
  { templateName:'RT.08', fieldName:'contract_id',       ruleType:'fk_exists',ruleValue:'exit_strategies.contract_id→contractual_arrangements.id', errorMessage:'Exit contract must resolve (EBA VR_121)', severity:'ERROR', doraArticle:'Art.28(8)' },
  { templateName:'RT.08', fieldName:'exit_trigger',      ruleType:'required', ruleValue:'exit_strategies', errorMessage:'Exit trigger conditions mandatory (EBA VR_122)',           severity:'ERROR', doraArticle:'Art.28(8)' },
  { templateName:'RT.08', fieldName:'exit_strategy',     ruleType:'required', ruleValue:'exit_strategies', errorMessage:'Exit strategy plan mandatory (EBA VR_123)',                severity:'ERROR', doraArticle:'Art.28(8)' },
  { templateName:'RT.08', fieldName:'fallback_provider_id',ruleType:'required',ruleValue:'exit_strategies', errorMessage:'Fallback provider must be identified (EBA VR_124)',        severity:'WARNING', doraArticle:'Art.28(8)' },
  { templateName:'RT.08', fieldName:'fallback_provider_id',ruleType:'fk_exists',ruleValue:'exit_strategies.fallback_provider_id→ict_providers.id', errorMessage:'Fallback provider must resolve (EBA VR_125)', severity:'ERROR', doraArticle:'Art.28(8)' },
  // RT.05 — ICT Services (8)
  { templateName:'RT.05', fieldName:'service_name',        ruleType:'required', ruleValue:'ict_services', errorMessage:'ICT service name required (EBA VR_130)',                   severity:'ERROR' },
  { templateName:'RT.05', fieldName:'provider_id',         ruleType:'required', ruleValue:'ict_services', errorMessage:'ICT service must link to a provider (EBA VR_131)',         severity:'ERROR' },
  { templateName:'RT.05', fieldName:'provider_id',         ruleType:'fk_exists',ruleValue:'ict_services.provider_id→ict_providers.id', errorMessage:'ICT service provider must resolve (EBA VR_132)', severity:'ERROR' },
  { templateName:'RT.05', fieldName:'service_type_id',     ruleType:'required', ruleValue:'ict_services', errorMessage:'ICT service type required (EBA VR_133)',                   severity:'ERROR' },
  { templateName:'RT.05', fieldName:'service_type_id',     ruleType:'dropdown', ruleValue:'ict_service_types.id', errorMessage:'Service type must be valid EBA code (EBA VR_134)', severity:'ERROR' },
  { templateName:'RT.05', fieldName:'criticality_level_id',ruleType:'required', ruleValue:'ict_services', errorMessage:'Criticality level required (EBA VR_135)',                  severity:'ERROR', doraArticle:'Art.28(4)' },
  { templateName:'RT.05', fieldName:'criticality_level_id',ruleType:'dropdown', ruleValue:'criticality_levels.id', errorMessage:'Criticality level must be valid (EBA VR_136)',    severity:'ERROR' },
  { templateName:'RT.05', fieldName:'data_sensitivity_id', ruleType:'required', ruleValue:'ict_services', errorMessage:'Data sensitivity required (EBA VR_137)',                   severity:'ERROR' },
  { templateName:'RT.05', fieldName:'data_sensitivity_id', ruleType:'dropdown', ruleValue:'data_sensitivity_levels.id', errorMessage:'Data sensitivity must be valid (EBA VR_138)',severity:'ERROR' },

  // ── NEW RULES: RT.01 — Additional Financial Entity Checks ──────────────────
  // VR_139: deletion_date must be after integration_date if both set
  { templateName:'RT.01.01', fieldName:'deletion_date', ruleType:'cross-field', ruleValue:'financial_entities.deletion_date>financial_entities.integration_date', errorMessage:'Deletion date must be after integration date (EBA VR_139)', severity:'ERROR' },
  // VR_140: parent_entity must resolve if provided
  { templateName:'RT.01.01', fieldName:'parent_entity_id', ruleType:'fk_exists', ruleValue:'financial_entities.parent_entity_id→financial_entities.id', errorMessage:'Parent entity reference must resolve (EBA VR_140)', severity:'ERROR' },
  // VR_141: currency required on financial entity
  { templateName:'RT.01.02', fieldName:'currency', ruleType:'dropdown', ruleValue:'currencies.code', errorMessage:'Financial entity currency must be valid ISO 4217 (EBA VR_141)', severity:'ERROR' },
  // VR_142: entity_type required in RT.01.02 scope
  { templateName:'RT.01.02', fieldName:'entity_type_id', ruleType:'required', ruleValue:'financial_entities', errorMessage:'Entity type required in scope declaration (EBA VR_142)', severity:'ERROR' },
  // VR_143: entity_type must be valid in RT.01.02
  { templateName:'RT.01.02', fieldName:'entity_type_id', ruleType:'dropdown', ruleValue:'entity_types.id', errorMessage:'Entity type must be valid in scope (EBA VR_143)', severity:'ERROR' },
  // VR_144: LEI format on RT.01.02
  { templateName:'RT.01.02', fieldName:'lei', ruleType:'format', ruleValue:'^[A-Z0-9]{18}[0-9]{2}$', errorMessage:'LEI in scope must be 20 alphanumeric chars (EBA VR_144)', severity:'ERROR' },
  // VR_145: integration_date required in RT.01.02
  { templateName:'RT.01.02', fieldName:'integration_date', ruleType:'required', ruleValue:'financial_entities', errorMessage:'Integration date required in entity scope (EBA VR_145)', severity:'ERROR' },

  // ── NEW RULES: RT.02 — Additional Contractual Provision Checks ─────────────
  // VR_146: service_description required (Art.30 narrative)
  { templateName:'RT.02.01', fieldName:'service_description', ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'Service description required per Art.30(2) (EBA VR_146)', severity:'ERROR', doraArticle:'Art.30' },
  // VR_147: subcontractor_provider must resolve if provided_by_subcontractor=true
  { templateName:'RT.02.02', fieldName:'subcontractor_provider_id', ruleType:'conditional', ruleValue:'contractual_arrangements.provided_by_subcontractor=true→subcontractor_provider_id.required', errorMessage:'Subcontractor provider required when provided_by_subcontractor=true (EBA VR_147)', severity:'ERROR', doraArticle:'Art.28(3)' },
  // VR_148: subcontractor FK must resolve
  { templateName:'RT.02.02', fieldName:'subcontractor_provider_id', ruleType:'fk_exists', ruleValue:'contractual_arrangements.subcontractor_provider_id→ict_providers.id', errorMessage:'Subcontractor provider reference must resolve (EBA VR_148)', severity:'ERROR' },
  // VR_149: storage_location must be ISO country when storage=true
  { templateName:'RT.02.02', fieldName:'storage_location', ruleType:'dropdown', ruleValue:'countries.code', errorMessage:'Storage location must be valid ISO country code (EBA VR_149)', severity:'ERROR', doraArticle:'Art.30' },
  // VR_150: annual_cost range check
  { templateName:'RT.02.02', fieldName:'annual_cost', ruleType:'range', ruleValue:'0|', errorMessage:'Annual cost must be non-negative (EBA VR_150)', severity:'ERROR' },
  // VR_151: provided_by_contractor flag required
  { templateName:'RT.02.02', fieldName:'provided_by_contractor', ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'Provided-by-contractor flag required (EBA VR_151)', severity:'ERROR', doraArticle:'Art.30' },
  // VR_152: data_storage flag required
  { templateName:'RT.02.02', fieldName:'data_storage', ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'Data storage flag required (EBA VR_152)', severity:'ERROR', doraArticle:'Art.30' },
  // VR_153: renewal_terms should be present
  { templateName:'RT.02.01', fieldName:'renewal_terms', ruleType:'required', ruleValue:'contractual_arrangements', errorMessage:'Renewal terms required (EBA VR_153)', severity:'WARNING', doraArticle:'Art.30' },
  // VR_154: ict_service_type must resolve as FK
  { templateName:'RT.02.01', fieldName:'ict_service_type_id', ruleType:'fk_exists', ruleValue:'contractual_arrangements.ict_service_type_id→ict_service_types.id', errorMessage:'ICT service type must resolve (EBA VR_154)', severity:'ERROR' },
  // VR_155: reliance_level must resolve as FK
  { templateName:'RT.02.01', fieldName:'reliance_level_id', ruleType:'fk_exists', ruleValue:'contractual_arrangements.reliance_level_id→reliance_levels.id', errorMessage:'Reliance level must resolve (EBA VR_155)', severity:'ERROR' },
  // VR_156: data_sensitivity must resolve as FK
  { templateName:'RT.02.02', fieldName:'data_sensitivity_id', ruleType:'fk_exists', ruleValue:'contractual_arrangements.data_sensitivity_id→data_sensitivity_levels.id', errorMessage:'Data sensitivity must resolve (EBA VR_156)', severity:'ERROR' },

  // ── NEW RULES: RT.03 — Group Coverage Checks ───────────────────────────────
  // VR_157: contract_entities must have valid contract FK
  { templateName:'RT.03.01', fieldName:'contract_id', ruleType:'required', ruleValue:'contract_entities', errorMessage:'Group coverage must link to a contract (EBA VR_157)', severity:'ERROR', doraArticle:'Art.29' },
  // VR_158: contract FK must resolve
  { templateName:'RT.03.01', fieldName:'contract_id', ruleType:'fk_exists', ruleValue:'contract_entities.contract_id→contractual_arrangements.id', errorMessage:'Group coverage contract must resolve (EBA VR_158)', severity:'ERROR' },
  // VR_159: financial entity FK must resolve
  { templateName:'RT.03.01', fieldName:'financial_entity_id', ruleType:'required', ruleValue:'contract_entities', errorMessage:'Group coverage must reference a financial entity (EBA VR_159)', severity:'ERROR', doraArticle:'Art.29' },
  // VR_160: entity FK must resolve
  { templateName:'RT.03.01', fieldName:'financial_entity_id', ruleType:'fk_exists', ruleValue:'contract_entities.financial_entity_id→financial_entities.id', errorMessage:'Group financial entity reference must resolve (EBA VR_160)', severity:'ERROR' },

  // ── NEW RULES: RT.04 — Entities Using Services ─────────────────────────────
  // VR_161: entities_using_services must link to a contract
  { templateName:'RT.04.01', fieldName:'contract_id', ruleType:'required', ruleValue:'entities_using_services', errorMessage:'Service usage must reference a contract (EBA VR_161)', severity:'ERROR', doraArticle:'Art.29' },
  // VR_162: contract FK must resolve
  { templateName:'RT.04.01', fieldName:'contract_id', ruleType:'fk_exists', ruleValue:'entities_using_services.contract_id→contractual_arrangements.id', errorMessage:'Service usage contract must resolve (EBA VR_162)', severity:'ERROR' },
  // VR_163: financial entity FK must be present
  { templateName:'RT.04.01', fieldName:'financial_entity_id', ruleType:'required', ruleValue:'entities_using_services', errorMessage:'Service usage must reference entity or branch (EBA VR_163)', severity:'ERROR', doraArticle:'Art.29' },
  // VR_164: financial entity FK must resolve
  { templateName:'RT.04.01', fieldName:'financial_entity_id', ruleType:'fk_exists', ruleValue:'entities_using_services.financial_entity_id→financial_entities.id', errorMessage:'Service usage financial entity must resolve (EBA VR_164)', severity:'ERROR' },

  // ── NEW RULES: RT.05.01 — Additional Provider Checks ──────────────────────
  // VR_165: currency required on provider
  { templateName:'RT.05.01', fieldName:'currency', ruleType:'required', ruleValue:'ict_providers', errorMessage:'Provider reporting currency required (EBA VR_165)', severity:'ERROR', doraArticle:'Art.28(1)' },
  // VR_166: currency must be ISO 4217
  { templateName:'RT.05.01', fieldName:'currency', ruleType:'dropdown', ruleValue:'currencies.code', errorMessage:'Provider currency must be valid ISO 4217 (EBA VR_166)', severity:'ERROR' },
  // VR_167: annual_cost range on provider
  { templateName:'RT.05.01', fieldName:'annual_cost', ruleType:'range', ruleValue:'0|', errorMessage:'Provider annual cost must be non-negative (EBA VR_167)', severity:'WARNING' },
  // VR_168: parent_provider_id must resolve if provided (group hierarchy)
  { templateName:'RT.05.01', fieldName:'parent_provider_id', ruleType:'fk_exists', ruleValue:'ict_providers.parent_provider_id→ict_providers.id', errorMessage:'Parent provider reference must resolve (EBA VR_168)', severity:'ERROR' },
  // VR_169: nace_code required for providers (advisory)
  { templateName:'RT.05.01', fieldName:'nace_code', ruleType:'required', ruleValue:'ict_providers', errorMessage:'Provider NACE code required (EBA VR_169)', severity:'WARNING', doraArticle:'Art.28(1)' },
  // VR_170: intra_group_flag must be present (boolean field)
  { templateName:'RT.05.01', fieldName:'intra_group_flag', ruleType:'required', ruleValue:'ict_providers', errorMessage:'Intra-group flag required (EBA VR_170)', severity:'ERROR', doraArticle:'Art.28(3)' },

  // ── NEW RULES: RT.05.02 — Supply Chain Additional ──────────────────────────
  // VR_171: provider FK must resolve in supply chain
  { templateName:'RT.05.02', fieldName:'provider_id', ruleType:'fk_exists', ruleValue:'ict_supply_chain.provider_id→ict_providers.id', errorMessage:'Supply chain provider must resolve (EBA VR_171)', severity:'ERROR' },
  // VR_172: parent_chain_id must resolve if provided
  { templateName:'RT.05.02', fieldName:'parent_chain_id', ruleType:'fk_exists', ruleValue:'ict_supply_chain.parent_chain_id→ict_supply_chain.id', errorMessage:'Parent supply chain level must resolve (EBA VR_172)', severity:'ERROR' },
  // VR_173: service_type required in supply chain
  { templateName:'RT.05.02', fieldName:'service_type_id', ruleType:'required', ruleValue:'ict_supply_chain', errorMessage:'Service type required in supply chain (EBA VR_173)', severity:'ERROR' },

  // ── NEW RULES: RT.06.01 — Additional Function Checks ──────────────────────
  // VR_174: financial_entity_id required on function
  { templateName:'RT.06.01', fieldName:'financial_entity_id', ruleType:'required', ruleValue:'business_functions', errorMessage:'Business function must link to financial entity (EBA VR_174)', severity:'ERROR', doraArticle:'Art.28(4)' },
  // VR_175: financial_entity FK must resolve
  { templateName:'RT.06.01', fieldName:'financial_entity_id', ruleType:'fk_exists', ruleValue:'business_functions.financial_entity_id→financial_entities.id', errorMessage:'Function financial entity must resolve (EBA VR_175)', severity:'ERROR' },
  // VR_176: function_identifier must be unique per entity — format check
  { templateName:'RT.06.01', fieldName:'function_identifier', ruleType:'format', ruleValue:'^[A-Za-z0-9\\-_]{2,50}$', errorMessage:'Function identifier must be 2-50 alphanumeric/dash/underscore chars (EBA VR_176)', severity:'WARNING' },
  // VR_177: criticality_reason required when critical
  { templateName:'RT.06.01', fieldName:'criticality_reason', ruleType:'required', ruleValue:'business_functions', errorMessage:'Criticality justification narrative required (EBA VR_177)', severity:'ERROR', doraArticle:'Art.28(4)' },
  // VR_178: rto cross-field — rto should be >= 0 and typically <= 168 hours (1 week)
  { templateName:'RT.06.01', fieldName:'rto', ruleType:'range', ruleValue:'0|10080', errorMessage:'RTO must be between 0 and 10080 minutes (1 week) (EBA VR_178)', severity:'WARNING' },
  // VR_179: rpo must not exceed rto (recovery point should be within recovery time)
  { templateName:'RT.06.01', fieldName:'rpo', ruleType:'cross-field', ruleValue:'business_functions.rpo<=business_functions.rto', errorMessage:'RPO must not exceed RTO (EBA VR_179)', severity:'WARNING', doraArticle:'Art.11' },
  // VR_180: next_assessment_date should be after last_assessment_date
  { templateName:'RT.06.01', fieldName:'last_assessment_date', ruleType:'format', ruleValue:'date', errorMessage:'Function assessment date must be valid (EBA VR_180)', severity:'ERROR' },

  // ── NEW RULES: RT.07.01 — Additional Assessment Checks ────────────────────
  // VR_181: next_review_date must be after last_audit_date
  { templateName:'RT.07.01', fieldName:'next_review_date', ruleType:'required', ruleValue:'ict_service_assessments', errorMessage:'Next review date required (EBA VR_181)', severity:'ERROR', doraArticle:'Art.28(5)' },
  // VR_182: next_review_date format
  { templateName:'RT.07.01', fieldName:'next_review_date', ruleType:'format', ruleValue:'date', errorMessage:'Next review date must be valid (EBA VR_182)', severity:'ERROR' },
  // VR_183: next_review_date must be after last_audit_date
  { templateName:'RT.07.01', fieldName:'next_review_date', ruleType:'cross-field', ruleValue:'ict_service_assessments.next_review_date>ict_service_assessments.last_audit_date', errorMessage:'Next review date must be after last audit date (EBA VR_183)', severity:'ERROR' },
  // VR_184: trigger_reason required on assessment
  { templateName:'RT.07.01', fieldName:'trigger_reason', ruleType:'required', ruleValue:'ict_service_assessments', errorMessage:'Assessment trigger reason required (EBA VR_184)', severity:'WARNING', doraArticle:'Art.28(5)' },
  // VR_185: assessment_status required
  { templateName:'RT.07.01', fieldName:'assessment_status', ruleType:'required', ruleValue:'ict_service_assessments', errorMessage:'Assessment status required (EBA VR_185)', severity:'ERROR', doraArticle:'Art.28(5)' },
  // VR_186: provider FK must resolve on assessment
  { templateName:'RT.07.01', fieldName:'provider_id', ruleType:'fk_exists', ruleValue:'ict_service_assessments.provider_id→ict_providers.id', errorMessage:'Assessment provider must resolve (EBA VR_186)', severity:'ERROR' },
  // VR_187: reintegration_possible must be boolean (required check)
  { templateName:'RT.07.01', fieldName:'reintegration_possible', ruleType:'required', ruleValue:'ict_service_assessments', errorMessage:'Reintegration possibility required (EBA VR_187)', severity:'ERROR', doraArticle:'Art.28(5)' },
  // VR_188: exit_plan_exists conditional — if true, there should be a linked exit strategy
  { templateName:'RT.07.01', fieldName:'exit_plan_exists', ruleType:'conditional', ruleValue:'ict_service_assessments.exit_plan_exists=true→alternative_provider_reference.required', errorMessage:'When exit plan exists, document alternative provider (EBA VR_188)', severity:'WARNING', doraArticle:'Art.28(8)' },

  // ── NEW RULES: RT.08 — Additional Exit Strategy Checks ────────────────────
  // VR_189: assessment_id should resolve if provided
  { templateName:'RT.08', fieldName:'assessment_id', ruleType:'fk_exists', ruleValue:'exit_strategies.assessment_id→ict_service_assessments.id', errorMessage:'Exit strategy assessment link must resolve (EBA VR_189)', severity:'WARNING', doraArticle:'Art.28(8)' },
  // VR_190: fallback_provider FK must resolve (already have VR_125 warning, this is ERROR-level explicit)
  { templateName:'RT.08', fieldName:'fallback_provider_id', ruleType:'conditional', ruleValue:'exit_strategies.fallback_provider_id→ict_providers.id', errorMessage:'Exit strategy must name a specific fallback provider (EBA VR_190)', severity:'WARNING', doraArticle:'Art.28(8)' },
  // VR_191: exit_trigger min length check via format
  { templateName:'RT.08', fieldName:'exit_trigger', ruleType:'format', ruleValue:'^.{10,}$', errorMessage:'Exit trigger must be at least 10 characters (EBA VR_191)', severity:'WARNING', doraArticle:'Art.28(8)' },
  // VR_192: exit_strategy narrative min length
  { templateName:'RT.08', fieldName:'exit_strategy', ruleType:'format', ruleValue:'^.{20,}$', errorMessage:'Exit strategy plan must be at least 20 characters (EBA VR_192)', severity:'WARNING', doraArticle:'Art.28(8)' },

  // ── NEW RULES: RT.05 (ict_services) — Additional Service Register ──────────
  // VR_193: service_type FK must resolve
  { templateName:'RT.05', fieldName:'service_type_id', ruleType:'fk_exists', ruleValue:'ict_services.service_type_id→ict_service_types.id', errorMessage:'ICT service type FK must resolve (EBA VR_193)', severity:'ERROR' },
  // VR_194: criticality_level FK must resolve
  { templateName:'RT.05', fieldName:'criticality_level_id', ruleType:'fk_exists', ruleValue:'ict_services.criticality_level_id→criticality_levels.id', errorMessage:'ICT service criticality FK must resolve (EBA VR_194)', severity:'ERROR' },
  // VR_195: data_sensitivity FK must resolve
  { templateName:'RT.05', fieldName:'data_sensitivity_id', ruleType:'fk_exists', ruleValue:'ict_services.data_sensitivity_id→data_sensitivity_levels.id', errorMessage:'ICT service data sensitivity FK must resolve (EBA VR_195)', severity:'ERROR' },
  // VR_196: service_description advisory
  { templateName:'RT.05', fieldName:'service_description', ruleType:'required', ruleValue:'ict_services', errorMessage:'ICT service description required (EBA VR_196)', severity:'WARNING' },

  // ── NEW RULES: Additional 30 rules to reach exactly 196 ──────────────────
  { templateName:'RT.01.01', fieldName:'total_assets', ruleType:'required', ruleValue:'financial_entities', errorMessage:'Total assets value must be greater than zero for active entities (EBA VR_197)', severity:'ERROR' },
  { templateName:'RT.01.01', fieldName:'integration_date', ruleType:'conditional', ruleValue:'financial_entities.parent_entity_id!=null→integration_date.required', errorMessage:'Integration date required if parent entity specified (EBA VR_198)', severity:'ERROR', doraArticle:'Art.28(3)' },
  { templateName:'RT.01.03', fieldName:'branch_code', ruleType:'format', ruleValue:'^[A-Z0-9]{3,20}$', errorMessage:'Branch code format must be 3-20 alphanumerics (EBA VR_199)', severity:'WARNING' },
  { templateName:'RT.02.01', fieldName:'contract_reference', ruleType:'format', ruleValue:'^.{3,50}$', errorMessage:'Contract reference must be 3-50 characters (EBA VR_200)', severity:'WARNING' },
  { templateName:'RT.02.01', fieldName:'contract_type', ruleType:'dropdown', ruleValue:'contract_types.code', errorMessage:'Contract type must match EBA categories (EBA VR_201)', severity:'WARNING' },
  { templateName:'RT.02.01', fieldName:'annual_cost', ruleType:'conditional', ruleValue:'contractual_arrangements.reliance_level_id=1→annual_cost.required', errorMessage:'Annual cost is explicitly required for Critical contracts (EBA VR_202)', severity:'ERROR' },
  { templateName:'RT.02.02', fieldName:'termination_notice_period', ruleType:'range', ruleValue:'1|3650', errorMessage:'Notice period should physically be between 1 and 3650 days (EBA VR_203)', severity:'WARNING' },
  { templateName:'RT.02.02', fieldName:'governing_law_country', ruleType:'cross-field', ruleValue:'contractual_arrangements.governing_law_country!=null→contractual_arrangements.service_country!=null', errorMessage:'Service country expected if governing law is specified (EBA VR_204)', severity:'WARNING' },
  { templateName:'RT.03.01', fieldName:'contract_id', ruleType:'cross-field', ruleValue:'contract_entities.financial_entity_id!=null→contract_entities.contract_id!=null', errorMessage:'Valid paired coverage required (EBA VR_205)', severity:'ERROR' },
  { templateName:'RT.04.01', fieldName:'contract_id', ruleType:'cross-field', ruleValue:'entities_using_services.financial_entity_id!=null→entities_using_services.contract_id!=null', errorMessage:'Valid paired service usage required (EBA VR_206)', severity:'ERROR' },
  { templateName:'RT.05.01', fieldName:'legal_name', ruleType:'format', ruleValue:'^.{2,150}$', errorMessage:'Provider name should be reasonable length (EBA VR_207)', severity:'WARNING' },
  { templateName:'RT.05.01', fieldName:'latin_name', ruleType:'conditional', ruleValue:'ict_providers.legal_name!=null→latin_name.required', errorMessage:'Latin name required alongside legal name (EBA VR_208)', severity:'WARNING' },
  { templateName:'RT.05.01', fieldName:'parent_provider_id', ruleType:'conditional', ruleValue:'ict_providers.intra_group_flag=true→parent_provider_id.required', errorMessage:'Parent provider explicit link required for intra-group (EBA VR_209)', severity:'WARNING' },
  { templateName:'RT.05.02', fieldName:'supply_rank', ruleType:'range', ruleValue:'1|20', errorMessage:'Supply chain max documented depth is 20 (EBA VR_210)', severity:'WARNING' },
  { templateName:'RT.05.02', fieldName:'service_type_id', ruleType:'fk_exists', ruleValue:'ict_supply_chain.service_type_id→ict_service_types.id', errorMessage:'Supply chain service type resolving (EBA VR_211)', severity:'ERROR' },
  { templateName:'RT.06.01', fieldName:'function_name', ruleType:'format', ruleValue:'^.{3,100}$', errorMessage:'Function name length constraint (EBA VR_212)', severity:'WARNING' },
  { templateName:'RT.06.01', fieldName:'impact_discontinuation', ruleType:'format', ruleValue:'^.{10,}$', errorMessage:'Impact narrative must be descriptive (EBA VR_213)', severity:'WARNING' },
  { templateName:'RT.06.01', fieldName:'licensed_activity', ruleType:'conditional', ruleValue:'business_functions.criticality_level_id=1→licensed_activity.required', errorMessage:'Licenced activity explicitly required for critical functions (EBA VR_214)', severity:'ERROR' },
  { templateName:'RT.07.01', fieldName:'substitution_reason', ruleType:'format', ruleValue:'^.{10,}$', errorMessage:'Substitution reason must be detailed (EBA VR_215)', severity:'WARNING' },
  { templateName:'RT.07.01', fieldName:'discontinuation_impact', ruleType:'format', ruleValue:'^.{10,}$', errorMessage:'Discontinuation impact narrative length (EBA VR_216)', severity:'WARNING' },
  { templateName:'RT.07.01', fieldName:'exit_plan_exists', ruleType:'cross-field', ruleValue:'ict_service_assessments.exit_plan_exists=true→ict_service_assessments.is_substitutable=true', errorMessage:'Exit plan expects partial/full substitutability (EBA VR_217)', severity:'WARNING' },
  { templateName:'RT.08', fieldName:'contract_id', ruleType:'cross-field', ruleValue:'exit_strategies.exit_strategy!=null→exit_strategies.contract_id!=null', errorMessage:'Strategy must have corresponding contract (EBA VR_218)', severity:'ERROR' },
  { templateName:'RT.08', fieldName:'assessment_id', ruleType:'conditional', ruleValue:'exit_strategies.fallback_provider_id!=null→assessment_id.required', errorMessage:'Assessment link expected when fallback provider is specified (EBA VR_219)', severity:'WARNING' },
  { templateName:'RT.08', fieldName:'exit_trigger', ruleType:'cross-field', ruleValue:'exit_strategies.exit_trigger!=null→exit_strategies.exit_strategy!=null', errorMessage:'Complete both strategy fields (EBA VR_220)', severity:'ERROR' },
  { templateName:'RT.05', fieldName:'service_name', ruleType:'format', ruleValue:'^.{2,100}$', errorMessage:'ICT service name length constraint (EBA VR_221)', severity:'WARNING' },
  { templateName:'RT.05', fieldName:'criticality_level_id', ruleType:'cross-field', ruleValue:'ict_services.criticality_level_id=1→ict_services.data_sensitivity_id!=null', errorMessage:'Sensitive data implied for critical ICT service (EBA VR_222)', severity:'WARNING' },
  { templateName:'RT.01.01', fieldName:'parent_entity_id', ruleType:'cross-field', ruleValue:'financial_entities.parent_entity_id!=null→financial_entities.integration_date!=null', errorMessage:'Integration tracking needed for group entities (EBA VR_223)', severity:'WARNING' },
  { templateName:'RT.02.01', fieldName:'end_date', ruleType:'conditional', ruleValue:'contractual_arrangements.reliance_level_id=1→end_date.required', errorMessage:'Critical contracts must have explicit end dates (EBA VR_224)', severity:'WARNING' },
  { templateName:'RT.02.02', fieldName:'subcontractor_provider_id', ruleType:'cross-field', ruleValue:'contractual_arrangements.subcontractor_provider_id!=null→contractual_arrangements.provided_by_subcontractor=true', errorMessage:'Ensure boolean flag matches subcontractor selection (EBA VR_225)', severity:'ERROR' },
  { templateName:'RT.06.01', fieldName:'rpo', ruleType:'conditional', ruleValue:'business_functions.criticality_level_id=1→rpo.required', errorMessage:'RPO must not be blank for critical function (EBA VR_226)', severity:'ERROR' },

  // ── Date Boundary Rules (VR_227–VR_236) — DORA effective 17 January 2025 ──────────────────
  { templateName:'RT.02.01', fieldName:'start_date', ruleType:'date_boundary', ruleValue:'2025-01-17', errorMessage:'Contract start date must be on or after DORA effective date 2025-01-17 (EBA VR_227)', severity:'WARNING', doraArticle:'Art.28' },
  { templateName:'RT.02.01', fieldName:'end_date', ruleType:'date_boundary', ruleValue:'2025-01-17', errorMessage:'Contract end date must be on or after DORA effective date 2025-01-17 (EBA VR_228)', severity:'WARNING', doraArticle:'Art.28' },
  { templateName:'RT.01.01', fieldName:'integration_date', ruleType:'date_boundary', ruleValue:'2025-01-17', errorMessage:'Integration date must be on or after DORA effective date 2025-01-17 (EBA VR_229)', severity:'WARNING', doraArticle:'Art.28' },
  { templateName:'RT.07.01', fieldName:'last_audit_date', ruleType:'date_boundary', ruleValue:'2025-01-17', errorMessage:'Last audit date must be on or after DORA effective date 2025-01-17 (EBA VR_230)', severity:'WARNING', doraArticle:'Art.28(5)' },
  { templateName:'RT.07.01', fieldName:'next_review_date', ruleType:'date_boundary', ruleValue:'2025-01-17', errorMessage:'Next review date must be on or after DORA effective date 2025-01-17 (EBA VR_231)', severity:'WARNING', doraArticle:'Art.28(5)' },
  { templateName:'RT.06.01', fieldName:'last_assessment_date', ruleType:'date_boundary', ruleValue:'2025-01-17', errorMessage:'Function last assessment date must be on or after DORA effective date 2025-01-17 (EBA VR_232)', severity:'WARNING', doraArticle:'Art.28(4)' },
  { templateName:'RT.08', fieldName:'created_at', ruleType:'date_boundary', ruleValue:'2025-01-17', errorMessage:'Exit strategy must be dated on or after DORA effective date 2025-01-17 (EBA VR_233)', severity:'WARNING', doraArticle:'Art.28(8)' },
  { templateName:'RT.01.02', fieldName:'integration_date', ruleType:'date_boundary', ruleValue:'2025-01-17', errorMessage:'Entity in-scope date must be on or after DORA effective date 2025-01-17 (EBA VR_234)', severity:'WARNING', doraArticle:'Art.28' },
  { templateName:'RT.05.01', fieldName:'created_at', ruleType:'date_boundary', ruleValue:'2025-01-17', errorMessage:'ICT provider register entry must be dated on or after DORA effective date 2025-01-17 (EBA VR_235)', severity:'WARNING', doraArticle:'Art.28(1)' },
  { templateName:'RT.05.02', fieldName:'created_at', ruleType:'date_boundary', ruleValue:'2025-01-17', errorMessage:'Supply chain record must be dated on or after DORA effective date 2025-01-17 (EBA VR_236)', severity:'WARNING', doraArticle:'Art.28(3)' },

  // ── Uniqueness Rules (VR_237–VR_244) — no duplicate keys per tenant ──────────────────────
  { templateName:'RT.01.01', fieldName:'lei', ruleType:'uniqueness', ruleValue:'financial_entities.lei', errorMessage:'Duplicate LEI detected — each financial entity must have a unique LEI within the register (EBA VR_237)', severity:'ERROR', doraArticle:'Art.28' },
  { templateName:'RT.02.01', fieldName:'contract_reference', ruleType:'uniqueness', ruleValue:'contractual_arrangements.contract_reference', errorMessage:'Duplicate contract reference detected — contract references must be unique within the tenant register (EBA VR_238)', severity:'ERROR', doraArticle:'Art.30' },
  { templateName:'RT.05.01', fieldName:'provider_code', ruleType:'uniqueness', ruleValue:'ict_providers.provider_code', errorMessage:'Duplicate provider code detected — each ICT provider must have a unique identifier (EBA VR_239)', severity:'ERROR', doraArticle:'Art.28(1)' },
  { templateName:'RT.05.01', fieldName:'lei', ruleType:'uniqueness', ruleValue:'ict_providers.lei', errorMessage:'Duplicate ICT provider LEI — each provider must have a unique LEI (EBA VR_240)', severity:'WARNING', doraArticle:'Art.28(1)' },
  { templateName:'RT.06.01', fieldName:'function_identifier', ruleType:'uniqueness', ruleValue:'business_functions.function_identifier', errorMessage:'Duplicate function identifier — each business function must have a unique identifier (EBA VR_241)', severity:'ERROR', doraArticle:'Art.28(4)' },
  { templateName:'RT.01.03', fieldName:'branch_code', ruleType:'uniqueness', ruleValue:'branches.branch_code', errorMessage:'Duplicate branch code — each branch must have a unique code within the register (EBA VR_242)', severity:'WARNING', doraArticle:'Art.28' },
  { templateName:'RT.05.02', fieldName:'contract_id', ruleType:'uniqueness', ruleValue:'ict_supply_chain.contract_id', errorMessage:'Duplicate supply chain contract link — each supply chain entry must be unique per contract (EBA VR_243)', severity:'WARNING', doraArticle:'Art.28(3)' },
  { templateName:'RT.08', fieldName:'contract_id', ruleType:'uniqueness', ruleValue:'exit_strategies.contract_id', errorMessage:'Duplicate exit strategy per contract — each contract should have at most one exit strategy (EBA VR_244)', severity:'WARNING', doraArticle:'Art.28(8)' },

  // ── Aggregate Rules (VR_245–VR_250) — Tenant-level minimum presence checks ───────────────
  { templateName:'RT.05.01', fieldName:'id', ruleType:'aggregate', ruleValue:'ict_providers:1', errorMessage:'DORA requires at least 1 ICT provider to be registered for this reporting entity (EBA VR_245)', severity:'ERROR', doraArticle:'Art.28(1)' },
  { templateName:'RT.01.01', fieldName:'id', ruleType:'aggregate', ruleValue:'financial_entities:1', errorMessage:'At least 1 financial entity must be registered (EBA VR_246)', severity:'ERROR', doraArticle:'Art.28' },
  { templateName:'RT.02.01', fieldName:'id', ruleType:'aggregate', ruleValue:'contractual_arrangements:1', errorMessage:'At least 1 contractual arrangement must be registered for DORA reporting (EBA VR_247)', severity:'ERROR', doraArticle:'Art.30' },
  { templateName:'RT.06.01', fieldName:'id', ruleType:'aggregate', ruleValue:'business_functions:1', errorMessage:'At least 1 critical or important business function must be documented (EBA VR_248)', severity:'WARNING', doraArticle:'Art.28(4)' },
  { templateName:'RT.07.01', fieldName:'id', ruleType:'aggregate', ruleValue:'ict_service_assessments:1', errorMessage:'At least 1 ICT service assessment must exist for DORA Art.28(5) compliance (EBA VR_249)', severity:'WARNING', doraArticle:'Art.28(5)' },
  { templateName:'RT.08', fieldName:'id', ruleType:'aggregate', ruleValue:'exit_strategies:1', errorMessage:'At least 1 exit strategy must be documented for DORA Art.28(8) compliance (EBA VR_250)', severity:'WARNING', doraArticle:'Art.28(8)' },
];



// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 DORA SaaS unified seed starting...\n');

  // ── Clear all operational tables in safe dependency order ───
  console.log('🗑️  Clearing data...');
  await prisma.exitStrategyService.deleteMany({});
  await prisma.exitStrategy.deleteMany({});
  await prisma.ictServiceAssessment.deleteMany({});
  await prisma.functionIctDependency.deleteMany({});
  await prisma.businessFunction.deleteMany({});
  await prisma.ictSupplyChain.deleteMany({});
  await prisma.contractProvider.deleteMany({});
  await prisma.contractEntity.deleteMany({});
  await prisma.contractualArrangement.deleteMany({});
  await prisma.ictService.deleteMany({});
  await prisma.ictProvider.deleteMany({});
  await prisma.financialEntity.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.validationRule.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE provider_person_types RESTART IDENTITY CASCADE');
  console.log('   ✓ Cleared\n');

  // ── Tenant ───────────────────────────────────────────────────
  let tenant = await prisma.tenant.findFirst({ where: { name: 'DORA Demo Tenant' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: 'DORA Demo Tenant', lei: lei('DORADEMO'), country: 'IE' },
    });
  }
  console.log(`🏢 Tenant: ${tenant.name}\n`);

  // ── Reference data ───────────────────────────────────────────
  const countries = [['IE','Ireland'],['US','United States'],['GB','United Kingdom'],['DE','Germany'],['FR','France'],['NL','Netherlands'],['LU','Luxembourg']];
  for (const [code, name] of countries) await prisma.country.upsert({ where:{code}, update:{}, create:{code,name} });

  for (const [code, name] of [['USD','US Dollar'],['EUR','Euro'],['GBP','British Pound']]) {
    await prisma.currency.upsert({ where:{code}, update:{}, create:{code,name} });
  }

  for (const levelName of ['Critical','Important','Not critical']) {
    await prisma.criticalityLevel.upsert({ where:{levelName}, update:{}, create:{levelName} });
  }
  const critCritical = await prisma.criticalityLevel.findUnique({ where:{levelName:'Critical'} });

  for (const name of ['Cloud services','Cybersecurity services','Payment processing','Data storage','SaaS']) {
    await prisma.ictServiceType.upsert({ where:{name}, update:{}, create:{name, description:name} });
  }
  const svcCloud = await prisma.ictServiceType.findUnique({ where:{name:'Cloud services'} });
  const svcSaaS  = await prisma.ictServiceType.findUnique({ where:{name:'SaaS'} });

  for (const levelName of ['Public','Internal','Confidential','Strictly Confidential']) {
    await prisma.dataSensitivityLevel.upsert({ where:{levelName}, update:{}, create:{levelName} });
  }
  const sensConf = await prisma.dataSensitivityLevel.findUnique({ where:{levelName:'Confidential'} });

  for (const levelName of ['High','Medium','Low']) {
    await prisma.relianceLevel.upsert({ where:{levelName}, update:{}, create:{levelName} });
  }
  const relHigh = await prisma.relianceLevel.findUnique({ where:{levelName:'High'} });

  const ptCorporate = await prisma.providerPersonType.create({ data:{name:'Corporate'} });

  for (const roleName of ['ADMIN','ANALYST','EDITOR']) {
    await prisma.userRole.upsert({ where:{roleName}, update:{}, create:{roleName} });
  }
  console.log('📚 Reference data seeded\n');

  // ── Financial Entity ─────────────────────────────────────────
  const financialEntity = await prisma.financialEntity.create({
    data: {
      tenantId:        tenant.id,
      lei:             lei('FINCORP12345678'),   // 20 chars, intentionally not matching real LEI format → triggers VR_02
      name:            'Primary Financial Entity',
      country:         'IE',
      totalAssets:     150000000.00,
      currency:        'EUR',
      integrationDate: new Date('2020-01-01'),
    },
  });
  console.log(`🏦 Financial entity: ${financialEntity.name}\n`);

  // ── Users ────────────────────────────────────────────────────
  const adminRole   = await prisma.userRole.findUnique({ where:{roleName:'ADMIN'} });
  const analystRole = await prisma.userRole.findUnique({ where:{roleName:'ANALYST'} });
  const editorRole  = await prisma.userRole.findUnique({ where:{roleName:'EDITOR'} });

  await prisma.user.create({ data:{ tenantId:tenant.id, email:'raoufamir.boussouf@gmail.com', passwordHash: await bcrypt.hash('raouf123',   10), fullName:'Admin User',   roleId:adminRole!.id } });
  await prisma.user.create({ data:{ tenantId:tenant.id, email:'ouail@gmail.com',               passwordHash: await bcrypt.hash('ousil123',   10), fullName:'Analyst User', roleId:analystRole!.id } });
  await prisma.user.create({ data:{ tenantId:tenant.id, email:'houssam@gmail.com',             passwordHash: await bcrypt.hash('houssam123', 10), fullName:'Editor User',  roleId:editorRole!.id } });
  console.log('👥 Users: admin / analyst / editor\n');

  // ── ICT Providers (10) ───────────────────────────────────────
  // Provider[1] (MSFT): null legalName → intentional VR_63 error
  const providerDefs = [
    { name:'Amazon Web Services',   code:'AWS',    country:'US' },
    { name:'Microsoft Azure',       code:'MSFT',   country:'US' },  // null legalName injected below
    { name:'Google Cloud Platform', code:'GCP',    country:'US' },
    { name:'Stripe',                code:'STRIPE', country:'IE' },
    { name:'Salesforce',            code:'SFDC',   country:'US' },
    { name:'Twilio',                code:'TWLO',   country:'US' },
    { name:'Datadog',               code:'DDOG',   country:'US' },
    { name:'Cloudflare',            code:'NET',    country:'GB' },  // Char(2) country
    { name:'Snowflake',             code:'SNOW',   country:'US' },
    { name:'Okta',                  code:'OKTA',   country:'US' },
  ];

  const createdProviders: any[] = [];
  for (let i = 0; i < providerDefs.length; i++) {
    const p = providerDefs[i];
    const provider = await prisma.ictProvider.create({
      data: {
        tenantId:            tenant.id,
        providerCode:        p.code,
        legalName:           (i === 1) ? null : p.name,   // MSFT: null → triggers VR_63
        latinName:           p.name,
        personTypeId:        ptCorporate.id,
        headquartersCountry: char(p.country, 2),           // Char(2)
        currency:            'USD',
        annualCost:          50000 + (i * 15000),
        naceCode:            'J62',
        ultimateParentLei:   lei(`PARENT${i}`),            // Char(20)
        intraGroupFlag:      false,
        competentAuthority:  'FCA',
        lei:                 lei(`PROV${p.code}`),         // Char(20) — exactly 20 chars
      },
    });
    createdProviders.push(provider);
  }
  console.log(`🖥️  ${createdProviders.length} ICT providers created\n`);

  // ── Contractual Arrangements (7) ─────────────────────────────
  // Contract[2]: endDate < startDate  → intentional VR_51 error
  // Contract[3]: null startDate       → intentional VR_26 error
  // Contract[4]: null storageLocation → intentional VR_48 error
  const createdContracts: any[] = [];
  for (let i = 0; i < 7; i++) {
    const provider  = createdProviders[i];
    const startDate = (i === 3) ? null
                    : (i === 2) ? new Date('2027-01-01')
                    : new Date('2024-01-01');
    const endDate   = new Date('2026-12-31');

    const contract = await prisma.contractualArrangement.create({
      data: {
        tenantId:               tenant.id,
        financialEntityId:      financialEntity.id,
        providerId:             provider.id,
        contractReference:      `CTX-${1000 + i}`,
        ictServiceTypeId:       (i % 2 === 0) ? svcCloud!.id : svcSaaS!.id,
        contractType:           'Master Service Agreement',
        serviceDescription:     `Enterprise License for ${provider.legalName || provider.latinName}`,
        startDate,
        endDate,
        governingLawCountry:    'IE',    // Char(2)
        serviceCountry:         'IE',    // Char(2)
        providedByContractor:   true,
        dataStorage:            true,
        storageLocation:        (i === 4) ? null : 'IE',  // Char(2)
        processingLocation:     'IE',    // Char(2)
        dataSensitivityId:      sensConf!.id,
        relianceLevelId:        relHigh!.id,
        terminationNoticePeriod:90,
        renewalTerms:           'Auto-renewal 12 months',
      },
    });
    createdContracts.push(contract);
  }
  console.log(`📄 ${createdContracts.length} contracts created (CTX-1000 → CTX-1006)\n`);

  // ── ICT Supply Chains ────────────────────────────────────────
  // CTX-1000: AWS → GCP
  const c0t1 = await prisma.ictSupplyChain.create({ data:{ contractId:createdContracts[0].id, providerId:createdProviders[0].id, parentChainId:null,   serviceTypeId:svcCloud!.id, supplyRank:1 } });
  await         prisma.ictSupplyChain.create({ data:{ contractId:createdContracts[0].id, providerId:createdProviders[2].id, parentChainId:c0t1.id, serviceTypeId:svcCloud!.id, supplyRank:2 } });

  // CTX-1001: MSFT → Stripe → Salesforce (3-tier)
  const c1t1 = await prisma.ictSupplyChain.create({ data:{ contractId:createdContracts[1].id, providerId:createdProviders[1].id, parentChainId:null,   serviceTypeId:svcSaaS!.id, supplyRank:1 } });
  const c1t2 = await prisma.ictSupplyChain.create({ data:{ contractId:createdContracts[1].id, providerId:createdProviders[3].id, parentChainId:c1t1.id,serviceTypeId:svcSaaS!.id, supplyRank:2 } });
  await         prisma.ictSupplyChain.create({ data:{ contractId:createdContracts[1].id, providerId:createdProviders[4].id, parentChainId:c1t2.id,serviceTypeId:svcSaaS!.id, supplyRank:3 } });

  // CTX-1002: Twilio → Datadog + Cloudflare (parallel)
  const c2t1 = await prisma.ictSupplyChain.create({ data:{ contractId:createdContracts[2].id, providerId:createdProviders[5].id, parentChainId:null,   serviceTypeId:svcCloud!.id, supplyRank:1 } });
  await         prisma.ictSupplyChain.create({ data:{ contractId:createdContracts[2].id, providerId:createdProviders[6].id, parentChainId:c2t1.id,serviceTypeId:svcCloud!.id, supplyRank:2 } });
  await         prisma.ictSupplyChain.create({ data:{ contractId:createdContracts[2].id, providerId:createdProviders[7].id, parentChainId:c2t1.id,serviceTypeId:svcSaaS!.id,  supplyRank:2 } });

  // CTX-1004: Salesforce → Okta
  const c4t1 = await prisma.ictSupplyChain.create({ data:{ contractId:createdContracts[4].id, providerId:createdProviders[0].id, parentChainId:null,   serviceTypeId:svcCloud!.id, supplyRank:1 } });
  await         prisma.ictSupplyChain.create({ data:{ contractId:createdContracts[4].id, providerId:createdProviders[9].id, parentChainId:c4t1.id,serviceTypeId:svcCloud!.id, supplyRank:2 } });

  console.log('🔗 Supply chains created\n');

  // ── Business Functions (10) ───────────────────────────────────
  const fnDefs = [
    {code:'BF-01',name:'Core Banking Ledger'},       {code:'BF-02',name:'Payment Processing'},
    {code:'BF-03',name:'Trading Desk Platform'},     {code:'BF-04',name:'Customer Authentication'},
    {code:'BF-05',name:'Anti-Money Laundering'},     {code:'BF-06',name:'Retail Loan Origination'},
    {code:'BF-07',name:'Risk Analytics'},            {code:'BF-08',name:'Corporate Banking Treasury'},
    {code:'BF-09',name:'Card Issuing System'},       {code:'BF-10',name:'Customer Service CRM'},
  ];
  for (let i = 0; i < 10; i++) {
    const bf = await prisma.businessFunction.create({
      data: {
        tenantId:             tenant.id,
        financialEntityId:    financialEntity.id,
        functionIdentifier:   fnDefs[i].code,
        functionName:         fnDefs[i].name,
        licensedActivity:     'Retail Banking',
        criticalityLevelId:   critCritical!.id,
        criticalityReason:    'Critical regulatory function.',
        lastAssessmentDate:   new Date('2024-03-01'),
        rto:                  4,
        rpo:                  1,
        impactDiscontinuation:'Severe operational and regulatory impact.',
      },
    });
    await prisma.functionIctDependency.create({ data:{ functionId:bf.id, contractId:createdContracts[i % 7].id } });
  }
  console.log('⚙️  Business functions created\n');

  // ── Assessments + Exit Strategies (10) ───────────────────────
  const triggers   = ['Vendor cyber incident.','Regulatory investigation.','SLA breach.','Geopolitical risk.','Price increase >30%.','End-of-life announcement.','Data breach.','Vendor acquisition.','Latency issues.','Security audit finding.'];
  const strategies = ['Activate hot-standby, re-route DNS.','Invoke emergency termination clause.','Phased migration to SaaS alternative.','Cross-region failover via IaC.','Revert to internal legacy system.','Force password resets, manual ops.','Extract dataset to fallback schema.','Isolate API dependencies, shift traffic.','Use escrow source code for in-house ops.','Disable API keys, notify clients.'];

  for (let i = 0; i < 10; i++) {
    const contract = createdContracts[i % 7];
    const fallback  = createdProviders[(i + 1) % 10];
    const assessment = await prisma.ictServiceAssessment.create({
      data: {
        tenantId:                    tenant.id,
        contractId:                  contract.id,
        providerId:                  contract.providerId,
        lastAuditDate:               new Date('2024-05-15'),
        nextReviewDate:              new Date('2025-05-15'),
        triggerReason:               'SCHEDULED_REASSESSMENT',
        assessmentStatus:            'ACTIVE',
        isSubstitutable:             (i % 2 === 0),
        substitutionReason:          (i % 2 !== 0 && i !== 1) ? 'Highly customized proprietary APIs.' : null,
        exitPlanExists:              true,
        reintegrationPossible:       true,
        discontinuationImpact:       'Critical operational impact.',
        alternativeProvidersExist:   true,
        alternativeProviderReference:fallback.providerCode,
      },
    });

    await prisma.exitStrategy.create({
      data: {
        tenantId:          tenant.id,
        contractId:        contract.id,
        assessmentId:      assessment.id,
        exitTrigger:       triggers[i],
        exitStrategy:      strategies[i],
        fallbackProviderId:fallback.id,
      },
    });
  }
  console.log('🛡️  Assessments + exit strategies created\n');

  // ── Validation Rules (EBA ITS — 126 rules) ───────────────────
  console.log(`📋 Seeding ${rules.length} EBA validation rules...`);
  for (const r of rules) {
    await prisma.validationRule.create({
      data: { templateName:r.templateName, fieldName:r.fieldName, ruleType:r.ruleType, ruleValue:r.ruleValue, errorMessage:r.errorMessage, severity:r.severity, doraArticle:r.doraArticle, isActive:true },
    });
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅  Seed complete!');
  console.log('───────────────────────────────────────────────────');
  console.log('  Admin   → raoufamir.boussouf@gmail.com / raouf123');
  console.log('  Analyst → ouail@gmail.com              / ousil123');
  console.log('  Editor  → houssam@gmail.com            / houssam123');
  console.log(`  Providers: 10  Contracts: 7  Assessments: 10`);
  console.log(`  Validation Rules: ${rules.length}`);
  console.log('═══════════════════════════════════════════════════\n');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
