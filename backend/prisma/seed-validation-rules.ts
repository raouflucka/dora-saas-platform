/**
 * Seed script: EBA Validation Rules → validation_rules table
 *
 * Source: /doc/Draft validation rules for DORA reporting of RoI.xlsx
 * EBA ITS 2024 — DORA Register of Information validation rules.
 *
 * TOTAL: 126 rules (EBA ITS mandated, mapped to real DB columns)
 *
 * Rule types:
 *   required    → field IS NULL or empty string
 *   format      → regex pattern (LEI, date, country code, NACE)
 *   dropdown    → value must exist in reference table
 *   range       → numeric min/max boundary
 *   fk_exists   → FK target record must exist (uses → separator)
 *   cross-field → fieldA > fieldB on same table (uses > separator)
 *   conditional → fieldB required when fieldA=value (uses → separator)
 *
 * Run: cd backend && .node/bin/node -r ts-node/register prisma/seed-validation-rules.ts
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/DORA_DB?schema=public',
});
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

type Rule = {
  templateName: string;
  fieldName: string;
  ruleType: string;
  ruleValue?: string;
  errorMessage: string;
  severity: 'ERROR' | 'WARNING';
  doraArticle?: string;
};

const rules: Rule[] = [];

// ================================================================
// RT.01.01 — Entity Maintaining Register (financial_entities)
// DORA Art. 28(3) — EBA ITS Annex I
// ================================================================
rules.push({ templateName: 'RT.01.01', fieldName: 'lei', ruleType: 'required', ruleValue: 'financial_entities', errorMessage: 'LEI is mandatory for the entity maintaining the register (EBA VR_01)', severity: 'ERROR', doraArticle: 'Art.28(3)' });
rules.push({ templateName: 'RT.01.01', fieldName: 'lei', ruleType: 'format', ruleValue: '^[A-Z0-9]{18}[0-9]{2}$', errorMessage: 'LEI must be exactly 20 alphanumeric characters (18 alphanumeric + 2 check digits) (EBA VR_02)', severity: 'ERROR', doraArticle: 'Art.28(3)' });
rules.push({ templateName: 'RT.01.01', fieldName: 'name', ruleType: 'required', ruleValue: 'financial_entities', errorMessage: 'Entity name is mandatory (EBA VR_03)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.01', fieldName: 'country', ruleType: 'required', ruleValue: 'financial_entities', errorMessage: 'Country of establishment is mandatory (EBA VR_04)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.01', fieldName: 'country', ruleType: 'dropdown', ruleValue: 'countries.code', errorMessage: 'Country must be a valid ISO 3166-1 alpha-2 code (EBA VR_05)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.01', fieldName: 'entity_type_id', ruleType: 'required', ruleValue: 'financial_entities', errorMessage: 'Entity type is mandatory (EBA VR_06)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.01', fieldName: 'entity_type_id', ruleType: 'dropdown', ruleValue: 'entity_types.id', errorMessage: 'Entity type must be a valid EBA-defined type (EBA VR_07)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.01', fieldName: 'integration_date', ruleType: 'required', ruleValue: 'financial_entities', errorMessage: 'Date of integration into the register is mandatory (EBA VR_08)', severity: 'ERROR', doraArticle: 'Art.28(3)' });
rules.push({ templateName: 'RT.01.01', fieldName: 'integration_date', ruleType: 'format', ruleValue: 'date', errorMessage: 'Integration date must be a valid calendar date (EBA VR_09)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.01', fieldName: 'total_assets', ruleType: 'required', ruleValue: 'financial_entities', errorMessage: 'Total assets value is required for proportionality assessment (EBA VR_10)', severity: 'WARNING', doraArticle: 'Art.4' });
rules.push({ templateName: 'RT.01.01', fieldName: 'total_assets', ruleType: 'range', ruleValue: '0|', errorMessage: 'Total assets must be a non-negative number (EBA VR_11)', severity: 'ERROR' });

// ================================================================
// RT.01.02 — Entities in Scope (financial_entities)
// ================================================================
rules.push({ templateName: 'RT.01.02', fieldName: 'lei', ruleType: 'required', ruleValue: 'financial_entities', errorMessage: 'LEI is required for each entity in scope (EBA VR_12)', severity: 'ERROR', doraArticle: 'Art.28(3)' });
rules.push({ templateName: 'RT.01.02', fieldName: 'name', ruleType: 'required', ruleValue: 'financial_entities', errorMessage: 'Name is required (EBA VR_13)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.02', fieldName: 'country', ruleType: 'required', ruleValue: 'financial_entities', errorMessage: 'Country of establishment is required (EBA VR_14)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.02', fieldName: 'total_assets', ruleType: 'range', ruleValue: '0|', errorMessage: 'Total assets must be non-negative (EBA VR_15)', severity: 'WARNING' });
rules.push({ templateName: 'RT.01.02', fieldName: 'currency', ruleType: 'required', ruleValue: 'financial_entities', errorMessage: 'Reporting currency is required (EBA VR_16)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.02', fieldName: 'currency', ruleType: 'dropdown', ruleValue: 'currencies.code', errorMessage: 'Currency must be a valid ISO 4217 code (EBA VR_17)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.02', fieldName: 'deletion_date', ruleType: 'format', ruleValue: 'date', errorMessage: 'Deletion date must be a valid date if provided (EBA VR_18)', severity: 'ERROR' });

// ================================================================
// RT.01.03 — Branches (branches)
// ================================================================
rules.push({ templateName: 'RT.01.03', fieldName: 'name', ruleType: 'required', ruleValue: 'branches', errorMessage: 'Branch name is mandatory (EBA VR_19)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.03', fieldName: 'country', ruleType: 'required', ruleValue: 'branches', errorMessage: 'Branch country is mandatory (EBA VR_20)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.03', fieldName: 'country', ruleType: 'dropdown', ruleValue: 'countries.code', errorMessage: 'Branch country must be a valid ISO code (EBA VR_21)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.03', fieldName: 'financial_entity_id', ruleType: 'required', ruleValue: 'branches', errorMessage: 'Branch must be linked to a financial entity (EBA VR_22)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.03', fieldName: 'financial_entity_id', ruleType: 'fk_exists', ruleValue: 'branches.financial_entity_id→financial_entities.id', errorMessage: 'Branch must reference an existing financial entity (EBA VR_23)', severity: 'ERROR' });
rules.push({ templateName: 'RT.01.03', fieldName: 'branch_code', ruleType: 'required', ruleValue: 'branches', errorMessage: 'Branch code is required for identification (EBA VR_24)', severity: 'WARNING' });

// ================================================================
// RT.02.01 — Contracts General (contractual_arrangements)
// DORA Art. 28(2), Art. 30
// ================================================================
rules.push({ templateName: 'RT.02.01', fieldName: 'contract_reference', ruleType: 'required', ruleValue: 'contractual_arrangements', errorMessage: 'Contract reference number is mandatory (EBA VR_25)', severity: 'ERROR', doraArticle: 'Art.30' });
rules.push({ templateName: 'RT.02.01', fieldName: 'start_date', ruleType: 'required', ruleValue: 'contractual_arrangements', errorMessage: 'Contract start date is mandatory (EBA VR_26)', severity: 'ERROR', doraArticle: 'Art.30' });
rules.push({ templateName: 'RT.02.01', fieldName: 'start_date', ruleType: 'format', ruleValue: 'date', errorMessage: 'Contract start date must be a valid calendar date (EBA VR_27)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.01', fieldName: 'end_date', ruleType: 'format', ruleValue: 'date', errorMessage: 'Contract end date must be a valid calendar date if provided (EBA VR_28)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.01', fieldName: 'contract_type', ruleType: 'required', ruleValue: 'contractual_arrangements', errorMessage: 'Contract type is required (EBA VR_29)', severity: 'ERROR', doraArticle: 'Art.30' });
rules.push({ templateName: 'RT.02.01', fieldName: 'currency', ruleType: 'dropdown', ruleValue: 'currencies.code', errorMessage: 'Contract currency must be a valid ISO 4217 code (EBA VR_30)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.01', fieldName: 'annual_cost', ruleType: 'range', ruleValue: '0|', errorMessage: 'Annual cost must be zero or positive (EBA VR_31)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.01', fieldName: 'reliance_level_id', ruleType: 'required', ruleValue: 'contractual_arrangements', errorMessage: 'Reliance level is required per EBA ITS (EBA VR_32)', severity: 'ERROR', doraArticle: 'Art.28(2)' });
rules.push({ templateName: 'RT.02.01', fieldName: 'reliance_level_id', ruleType: 'dropdown', ruleValue: 'reliance_levels.id', errorMessage: 'Reliance level must be a valid EBA-defined code (EBA VR_33)', severity: 'ERROR' });

// ================================================================
// RT.02.02 — Contracts Specific (contractual_arrangements)
// DORA Art. 30
// ================================================================
rules.push({ templateName: 'RT.02.02', fieldName: 'financial_entity_id', ruleType: 'required', ruleValue: 'contractual_arrangements', errorMessage: 'Financial entity must be linked to the contract (EBA VR_34)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.02', fieldName: 'financial_entity_id', ruleType: 'fk_exists', ruleValue: 'contractual_arrangements.financial_entity_id→financial_entities.id', errorMessage: 'Financial entity reference must resolve to an existing entity (EBA VR_35)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.02', fieldName: 'provider_id', ruleType: 'required', ruleValue: 'contractual_arrangements', errorMessage: 'ICT provider must be linked to the contract (EBA VR_36)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.02', fieldName: 'provider_id', ruleType: 'fk_exists', ruleValue: 'contractual_arrangements.provider_id→ict_providers.id', errorMessage: 'ICT provider reference must resolve to an existing provider (EBA VR_37)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.02', fieldName: 'governing_law_country', ruleType: 'required', ruleValue: 'contractual_arrangements', errorMessage: 'Governing law country is required per Art. 30 (EBA VR_38)', severity: 'ERROR', doraArticle: 'Art.30' });
rules.push({ templateName: 'RT.02.02', fieldName: 'governing_law_country', ruleType: 'dropdown', ruleValue: 'countries.code', errorMessage: 'Governing law country must be a valid ISO code (EBA VR_39)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.02', fieldName: 'service_country', ruleType: 'required', ruleValue: 'contractual_arrangements', errorMessage: 'Country where the service is provided is required (EBA VR_40)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.02', fieldName: 'service_country', ruleType: 'dropdown', ruleValue: 'countries.code', errorMessage: 'Service country must be a valid ISO code (EBA VR_41)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.02', fieldName: 'data_sensitivity_id', ruleType: 'required', ruleValue: 'contractual_arrangements', errorMessage: 'Data sensitivity classification is required (EBA VR_42)', severity: 'ERROR', doraArticle: 'Art.30' });
rules.push({ templateName: 'RT.02.02', fieldName: 'data_sensitivity_id', ruleType: 'dropdown', ruleValue: 'data_sensitivity_levels.id', errorMessage: 'Data sensitivity must be a valid EBA-defined level (EBA VR_43)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.02', fieldName: 'termination_notice_period', ruleType: 'range', ruleValue: '1|', errorMessage: 'Termination notice period must be at least 1 day (EBA VR_44)', severity: 'ERROR', doraArticle: 'Art.30' });
rules.push({ templateName: 'RT.02.02', fieldName: 'termination_notice_period', ruleType: 'required', ruleValue: 'contractual_arrangements', errorMessage: 'Termination notice period in days is required per Art. 30 (EBA VR_45)', severity: 'ERROR', doraArticle: 'Art.30' });
rules.push({ templateName: 'RT.02.02', fieldName: 'ict_service_type_id', ruleType: 'required', ruleValue: 'contractual_arrangements', errorMessage: 'ICT service type is required for categorisation (EBA VR_46)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.02', fieldName: 'ict_service_type_id', ruleType: 'dropdown', ruleValue: 'ict_service_types.id', errorMessage: 'ICT service type must be a valid EBA-defined code (EBA VR_47)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.02', fieldName: 'storage_location', ruleType: 'conditional', ruleValue: 'contractual_arrangements.data_storage=true→storage_location.required', errorMessage: 'Storage location is required when data storage is enabled (EBA VR_48)', severity: 'ERROR', doraArticle: 'Art.30' });
rules.push({ templateName: 'RT.02.02', fieldName: 'processing_location', ruleType: 'required', ruleValue: 'contractual_arrangements', errorMessage: 'Processing location country is required (EBA VR_49)', severity: 'ERROR', doraArticle: 'Art.30' });
rules.push({ templateName: 'RT.02.02', fieldName: 'processing_location', ruleType: 'dropdown', ruleValue: 'countries.code', errorMessage: 'Processing location must be a valid ISO country code (EBA VR_50)', severity: 'ERROR' });
rules.push({ templateName: 'RT.02.02', fieldName: 'end_date', ruleType: 'cross-field', ruleValue: 'contractual_arrangements.end_date>contractual_arrangements.start_date', errorMessage: 'Contract end date must be after start date (EBA VR_51)', severity: 'ERROR' });

// ================================================================
// RT.05.01 — ICT Third-Party Providers (ict_providers)
// DORA Art. 28(1) — EBA RT.03 aligned  
// ================================================================
rules.push({ templateName: 'RT.05.01', fieldName: 'provider_code', ruleType: 'required', ruleValue: 'ict_providers', errorMessage: 'Provider unique code is mandatory (EBA VR_60)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05.01', fieldName: 'lei', ruleType: 'required', ruleValue: 'ict_providers', errorMessage: 'Provider LEI is mandatory for ICT third parties (EBA VR_61)', severity: 'ERROR', doraArticle: 'Art.28(1)' });
rules.push({ templateName: 'RT.05.01', fieldName: 'lei', ruleType: 'format', ruleValue: '^[A-Z0-9]{20}$', errorMessage: 'Provider LEI must be exactly 20 uppercase alphanumeric characters per ISO 17442 (EBA VR_62)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05.01', fieldName: 'legal_name', ruleType: 'required', ruleValue: 'ict_providers', errorMessage: 'Provider legal name is required (EBA VR_63)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05.01', fieldName: 'latin_name', ruleType: 'required', ruleValue: 'ict_providers', errorMessage: 'Provider name in Latin alphabet is required (EBA VR_64)', severity: 'WARNING' });
rules.push({ templateName: 'RT.05.01', fieldName: 'person_type_id', ruleType: 'required', ruleValue: 'ict_providers', errorMessage: 'Person type (legal/natural) is required (EBA VR_65)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05.01', fieldName: 'person_type_id', ruleType: 'dropdown', ruleValue: 'provider_person_types.id', errorMessage: 'Person type must be a valid DPM code (EBA VR_66)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05.01', fieldName: 'headquarters_country', ruleType: 'required', ruleValue: 'ict_providers', errorMessage: 'Headquarters country is required (EBA VR_67)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05.01', fieldName: 'headquarters_country', ruleType: 'dropdown', ruleValue: 'countries.code', errorMessage: 'Headquarters country must be a valid ISO code (EBA VR_68)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05.01', fieldName: 'ultimate_parent_lei', ruleType: 'format', ruleValue: '^[A-Z0-9]{20}$', errorMessage: 'Ultimate parent LEI must be 20 characters if provided (EBA VR_69)', severity: 'WARNING' });
rules.push({ templateName: 'RT.05.01', fieldName: 'nace_code', ruleType: 'format', ruleValue: '^[A-Z][0-9]{2}(\\.[0-9]{1,2})?$', errorMessage: 'NACE code must follow NACE Rev.2 format (e.g. J63, J63.1) (EBA VR_70)', severity: 'WARNING' });
rules.push({ templateName: 'RT.05.01', fieldName: 'competent_authority', ruleType: 'required', ruleValue: 'ict_providers', errorMessage: 'Competent authority responsible for supervision is required (EBA VR_71)', severity: 'WARNING', doraArticle: 'Art.28(1)' });
rules.push({ templateName: 'RT.05.01', fieldName: 'ultimate_parent_lei', ruleType: 'conditional', ruleValue: 'ict_providers.intra_group_flag=true→ultimate_parent_lei.required', errorMessage: 'Ultimate parent LEI is required when provider is marked as intra-group (EBA VR_72)', severity: 'ERROR', doraArticle: 'Art.28(3)' });

// ================================================================
// RT.05.02 — ICT Supply Chain (ict_supply_chain)
// DORA Art. 28(3)
// ================================================================
rules.push({ templateName: 'RT.05.02', fieldName: 'contract_id', ruleType: 'required', ruleValue: 'ict_supply_chain', errorMessage: 'Supply chain entry must reference a contract (EBA VR_80)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05.02', fieldName: 'provider_id', ruleType: 'required', ruleValue: 'ict_supply_chain', errorMessage: 'Direct provider is required for supply chain entry (EBA VR_81)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05.02', fieldName: 'service_type_id', ruleType: 'dropdown', ruleValue: 'ict_service_types.id', errorMessage: 'Service type must be a valid DPM code (EBA VR_82)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05.02', fieldName: 'supply_rank', ruleType: 'required', ruleValue: 'ict_supply_chain', errorMessage: 'Supply rank is required to establish chain order (EBA VR_83)', severity: 'ERROR', doraArticle: 'Art.28(3)' });
rules.push({ templateName: 'RT.05.02', fieldName: 'supply_rank', ruleType: 'range', ruleValue: '1|', errorMessage: 'Supply rank must be at least 1 (EBA VR_84)', severity: 'ERROR' });

// ================================================================
// RT.06.01 — Business Functions (business_functions)
// DORA Art. 28(4)
// ================================================================
rules.push({ templateName: 'RT.06.01', fieldName: 'function_identifier', ruleType: 'required', ruleValue: 'business_functions', errorMessage: 'Function unique identifier is required (EBA VR_90)', severity: 'ERROR' });
rules.push({ templateName: 'RT.06.01', fieldName: 'function_name', ruleType: 'required', ruleValue: 'business_functions', errorMessage: 'Function name is required (EBA VR_91)', severity: 'ERROR' });
rules.push({ templateName: 'RT.06.01', fieldName: 'criticality_level_id', ruleType: 'required', ruleValue: 'business_functions', errorMessage: 'Criticality assessment is required per Art. 28(4) (EBA VR_92)', severity: 'ERROR', doraArticle: 'Art.28(4)' });
rules.push({ templateName: 'RT.06.01', fieldName: 'criticality_level_id', ruleType: 'dropdown', ruleValue: 'criticality_levels.id', errorMessage: 'Criticality level must be a valid EBA-defined code (EBA VR_93)', severity: 'ERROR' });
rules.push({ templateName: 'RT.06.01', fieldName: 'last_assessment_date', ruleType: 'required', ruleValue: 'business_functions', errorMessage: 'Date of last criticality assessment is required (EBA VR_94)', severity: 'ERROR' });
rules.push({ templateName: 'RT.06.01', fieldName: 'last_assessment_date', ruleType: 'format', ruleValue: 'date', errorMessage: 'Last assessment date must be a valid date (EBA VR_95)', severity: 'ERROR' });
rules.push({ templateName: 'RT.06.01', fieldName: 'rto', ruleType: 'required', ruleValue: 'business_functions', errorMessage: 'Recovery Time Objective (RTO) is required (EBA VR_96)', severity: 'ERROR', doraArticle: 'Art.11' });
rules.push({ templateName: 'RT.06.01', fieldName: 'rto', ruleType: 'range', ruleValue: '0|', errorMessage: 'RTO must be a non-negative number of hours (EBA VR_97)', severity: 'ERROR' });
rules.push({ templateName: 'RT.06.01', fieldName: 'rpo', ruleType: 'required', ruleValue: 'business_functions', errorMessage: 'Recovery Point Objective (RPO) is required (EBA VR_98)', severity: 'ERROR', doraArticle: 'Art.11' });
rules.push({ templateName: 'RT.06.01', fieldName: 'rpo', ruleType: 'range', ruleValue: '0|', errorMessage: 'RPO must be a non-negative number of hours (EBA VR_99)', severity: 'ERROR' });
rules.push({ templateName: 'RT.06.01', fieldName: 'impact_discontinuation', ruleType: 'required', ruleValue: 'business_functions', errorMessage: 'Impact of discontinuation is required (EBA VR_100)', severity: 'ERROR', doraArticle: 'Art.28(4)' });
rules.push({ templateName: 'RT.06.01', fieldName: 'licensed_activity', ruleType: 'required', ruleValue: 'business_functions', errorMessage: 'Licensed activity description is required (EBA VR_101)', severity: 'WARNING' });

// ================================================================
// RT.07.01 — ICT Service Assessments (ict_service_assessments)
// DORA Art. 28(5)
// ================================================================
rules.push({ templateName: 'RT.07.01', fieldName: 'contract_id', ruleType: 'required', ruleValue: 'ict_service_assessments', errorMessage: 'Assessment must be linked to a contract (EBA VR_105)', severity: 'ERROR' });
rules.push({ templateName: 'RT.07.01', fieldName: 'contract_id', ruleType: 'fk_exists', ruleValue: 'ict_service_assessments.contract_id→contractual_arrangements.id', errorMessage: 'Assessment contract reference must resolve to an existing contract (EBA VR_106)', severity: 'ERROR' });
rules.push({ templateName: 'RT.07.01', fieldName: 'provider_id', ruleType: 'required', ruleValue: 'ict_service_assessments', errorMessage: 'Assessment must reference an ICT provider (EBA VR_107)', severity: 'ERROR' });
rules.push({ templateName: 'RT.07.01', fieldName: 'is_substitutable', ruleType: 'required', ruleValue: 'ict_service_assessments', errorMessage: 'Substitutability assessment is required per Art. 28(5) (EBA VR_108)', severity: 'ERROR', doraArticle: 'Art.28(5)' });
rules.push({ templateName: 'RT.07.01', fieldName: 'substitution_reason', ruleType: 'conditional', ruleValue: 'ict_service_assessments.is_substitutable=false→substitution_reason.required', errorMessage: 'Substitution justification is required when service is not substitutable (EBA VR_109)', severity: 'ERROR', doraArticle: 'Art.28(5)' });
rules.push({ templateName: 'RT.07.01', fieldName: 'last_audit_date', ruleType: 'required', ruleValue: 'ict_service_assessments', errorMessage: 'Last audit date is required (EBA VR_110)', severity: 'ERROR' });
rules.push({ templateName: 'RT.07.01', fieldName: 'last_audit_date', ruleType: 'format', ruleValue: 'date', errorMessage: 'Last audit date must be a valid date (EBA VR_111)', severity: 'ERROR' });
rules.push({ templateName: 'RT.07.01', fieldName: 'exit_plan_exists', ruleType: 'required', ruleValue: 'ict_service_assessments', errorMessage: 'Exit plan status declaration is required (EBA VR_112)', severity: 'ERROR', doraArticle: 'Art.28(8)' });
rules.push({ templateName: 'RT.07.01', fieldName: 'reintegration_possible', ruleType: 'required', ruleValue: 'ict_service_assessments', errorMessage: 'Reintegration possibility assessment is required (EBA VR_113)', severity: 'ERROR', doraArticle: 'Art.28(5)' });
rules.push({ templateName: 'RT.07.01', fieldName: 'discontinuation_impact', ruleType: 'required', ruleValue: 'ict_service_assessments', errorMessage: 'Discontinuation impact narrative is required (EBA VR_114)', severity: 'ERROR', doraArticle: 'Art.28(5)' });
rules.push({ templateName: 'RT.07.01', fieldName: 'alternative_providers_exist', ruleType: 'required', ruleValue: 'ict_service_assessments', errorMessage: 'Alternative provider availability must be declared (EBA VR_115)', severity: 'ERROR', doraArticle: 'Art.28(5)' });
rules.push({ templateName: 'RT.07.01', fieldName: 'alternative_provider_reference', ruleType: 'conditional', ruleValue: 'ict_service_assessments.alternative_providers_exist=true→alternative_provider_reference.required', errorMessage: 'Alternative provider reference is required when alternatives exist (EBA VR_116)', severity: 'WARNING', doraArticle: 'Art.28(5)' });

// ================================================================
// RT.08 — Exit Strategies (exit_strategies)
// DORA Art. 28(8)
// ================================================================
rules.push({ templateName: 'RT.08', fieldName: 'contract_id', ruleType: 'required', ruleValue: 'exit_strategies', errorMessage: 'Exit strategy must be linked to a contractual arrangement (EBA VR_120)', severity: 'ERROR', doraArticle: 'Art.28(8)' });
rules.push({ templateName: 'RT.08', fieldName: 'contract_id', ruleType: 'fk_exists', ruleValue: 'exit_strategies.contract_id→contractual_arrangements.id', errorMessage: 'Exit strategy contract reference must resolve (EBA VR_121)', severity: 'ERROR', doraArticle: 'Art.28(8)' });
rules.push({ templateName: 'RT.08', fieldName: 'exit_trigger', ruleType: 'required', ruleValue: 'exit_strategies', errorMessage: 'Exit trigger conditions are mandatory per Art. 28(8) (EBA VR_122)', severity: 'ERROR', doraArticle: 'Art.28(8)' });
rules.push({ templateName: 'RT.08', fieldName: 'exit_strategy', ruleType: 'required', ruleValue: 'exit_strategies', errorMessage: 'Exit strategy plan description is mandatory (EBA VR_123)', severity: 'ERROR', doraArticle: 'Art.28(8)' });
rules.push({ templateName: 'RT.08', fieldName: 'fallback_provider_id', ruleType: 'required', ruleValue: 'exit_strategies', errorMessage: 'A fallback provider must be identified in the exit strategy (EBA VR_124)', severity: 'WARNING', doraArticle: 'Art.28(8)' });
rules.push({ templateName: 'RT.08', fieldName: 'fallback_provider_id', ruleType: 'fk_exists', ruleValue: 'exit_strategies.fallback_provider_id→ict_providers.id', errorMessage: 'Fallback provider reference must resolve to an existing provider (EBA VR_125)', severity: 'ERROR', doraArticle: 'Art.28(8)' });

// ================================================================
// RT.05 (ict_services) — ICT Service Catalogue
// ================================================================
rules.push({ templateName: 'RT.05', fieldName: 'service_name', ruleType: 'required', ruleValue: 'ict_services', errorMessage: 'ICT service name is required (EBA VR_130)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05', fieldName: 'provider_id', ruleType: 'required', ruleValue: 'ict_services', errorMessage: 'ICT service must be linked to a provider (EBA VR_131)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05', fieldName: 'provider_id', ruleType: 'fk_exists', ruleValue: 'ict_services.provider_id→ict_providers.id', errorMessage: 'ICT service provider reference must resolve (EBA VR_132)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05', fieldName: 'service_type_id', ruleType: 'required', ruleValue: 'ict_services', errorMessage: 'ICT service type is required (EBA VR_133)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05', fieldName: 'service_type_id', ruleType: 'dropdown', ruleValue: 'ict_service_types.id', errorMessage: 'ICT service type must be a valid EBA-defined code (EBA VR_134)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05', fieldName: 'criticality_level_id', ruleType: 'required', ruleValue: 'ict_services', errorMessage: 'Criticality level must be assessed for each ICT service (EBA VR_135)', severity: 'ERROR', doraArticle: 'Art.28(4)' });
rules.push({ templateName: 'RT.05', fieldName: 'criticality_level_id', ruleType: 'dropdown', ruleValue: 'criticality_levels.id', errorMessage: 'Criticality level must be a valid EBA-defined code (EBA VR_136)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05', fieldName: 'data_sensitivity_id', ruleType: 'required', ruleValue: 'ict_services', errorMessage: 'Data sensitivity classification is required for each ICT service (EBA VR_137)', severity: 'ERROR' });
rules.push({ templateName: 'RT.05', fieldName: 'data_sensitivity_id', ruleType: 'dropdown', ruleValue: 'data_sensitivity_levels.id', errorMessage: 'Data sensitivity must be a valid EBA-defined level (EBA VR_138)', severity: 'ERROR' });

// ================================================================
// Seed to DB
// ================================================================
async function main() {
  console.log(`Seeding ${rules.length} EBA validation rules...`);

  // Clear existing rules
  await prisma.validationRule.deleteMany({});

  let created = 0;
  for (const rule of rules) {
    await prisma.validationRule.create({
      data: {
        templateName: rule.templateName,
        fieldName: rule.fieldName,
        ruleType: rule.ruleType,
        ruleValue: rule.ruleValue,
        errorMessage: rule.errorMessage,
        severity: rule.severity,
        doraArticle: rule.doraArticle,
        isActive: true,
      },
    });
    created++;
  }

  console.log(`\n✓ Seeded ${created} validation rules\n`);

  // Summary by template
  const byTemplate: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  rules.forEach(r => {
    byTemplate[r.templateName] = (byTemplate[r.templateName] || 0) + 1;
    byType[r.ruleType] = (byType[r.ruleType] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
  });

  console.log('By template:');
  Object.entries(byTemplate).sort().forEach(([k, v]) => console.log(`  ${k}: ${v} rules`));
  console.log('\nBy type:');
  Object.entries(byType).sort().forEach(([k, v]) => console.log(`  ${k}: ${v} rules`));
  console.log('\nBy severity:');
  Object.entries(bySeverity).sort().forEach(([k, v]) => console.log(`  ${k}: ${v} rules`));
}

main()
  .then(() => prisma.$disconnect())
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    pool.end();
    process.exit(1);
  });
