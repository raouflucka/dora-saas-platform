# EBA ITS Validation Rules Mapping

This document reflects **220 EBA validation rules** currently seeded into the `validation_rules` table of the DORA SaaS application (VR_01 through VR_250). These rules implement the EBA ITS (Implementing Technical Standards) validation checks for the Register of Information (RoI) templates, covering all major DORA reporting areas from financial entities through to exit strategies.

**Last updated**: 2026-04-19 (Session 15 — Security Hardening + Rule Expansion)  
**Seed script**: `backend/prisma/seed.ts`  
**Source spreadsheet**: `doc/Draft validation rules for DORA reporting of RoI.xlsx` (EBA official)

---

## Summary

### Rule Count by Template

| Template   | Description                    | DB Table                   | Rules |
|------------|--------------------------------|----------------------------|------:|
| RT.01.01   | Entity maintaining register    | `financial_entities`       |    14 |
| RT.01.02   | Entities in scope              | `financial_entities`       |    12 |
| RT.01.03   | Branches                       | `branches`                 |     7 |
| RT.02.01   | Contracts general              | `contractual_arrangements` |    14 |
| RT.02.02   | Contracts specific             | `contractual_arrangements` |    24 |
| RT.03.01   | Group coverage                 | `contract_entities`        |     4 |
| RT.04.01   | Entities using services        | `entities_using_services`  |     4 |
| RT.05      | ICT service catalogue          | `ict_services`             |    13 |
| RT.05.01   | ICT providers                  | `ict_providers`            |    19 |
| RT.05.02   | Supply chain                   | `ict_supply_chain`         |     8 |
| RT.06.01   | Business functions             | `business_functions`       |    19 |
| RT.07.01   | ICT service assessments        | `ict_service_assessments`  |    20 |
| RT.08      | Exit strategies                | `exit_strategies`          |    10 |
| RT.09.01   | Concentration risk             | `RiskService` aggregation  |     0 |
| **Total**  |                                |                            | **220** |

> **Note**: The EBA draft validation spreadsheet contains approximately 300+ rules in total. The 220 rules implemented represent deliberate coverage: all 10 rule types are represented, all 9 active export templates are covered including 3 new categories (date_boundary, uniqueness, aggregate). The remaining ~80 rules are primarily advanced inter-template cross-checks and some advanced RT.09 concentration-risk threshold checks, which are deferred to future work.

### Rule Count by Type

| Rule Type      | Count | Description                                                         |
|----------------|------:|---------------------------------------------------------------------|
| `required`     |    85 | Field must be non-null or non-empty                                 |
| `format`       |    22 | Regex pattern or date format matching                               |
| `dropdown`     |    30 | Value must exist in a reference/lookup table                        |
| `range`        |    12 | Numeric min/max boundary                                            |
| `fk_exists`    |    28 | Foreign key must resolve to an existing record                      |
| `cross-field`  |    12 | Logical relationship between two fields on the same record          |
| `conditional`  |     7 | Field B required when field A has a given value                     |
| `date_boundary`|    10 | Field date must be on or after DORA effective date 2025-01-17       |
| `uniqueness`   |     8 | No two records may have the same value for this field per tenant    |
| `aggregate`    |     6 | Tenant-level minimum count check                                    |

### Rule Count by Severity

| Severity | Count |
|----------|------:|
| ERROR    |   153 |
| WARNING  |    67 |

### Coverage by DORA Article

| DORA Article | Subject                         | Rules Covering |
|--------------|---------------------------------|---------------|
| Art. 28(1)   | ICT dependencies identification | 19            |
| Art. 28(2)   | Contractual arrangements        | 24            |
| Art. 28(3)   | Supply chain traceability       | 12            |
| Art. 28(4)   | Critical function classification| 10            |
| Art. 28(5)   | Substitutability assessments    | 14            |
| Art. 28(8)   | Exit strategies                 | 10            |
| Art. 29      | Group-level coverage            |  8            |
| Art. 30      | Contractual provisions          | 12            |
| Art. 11      | RTO/RPO resilience              |  3            |
| Art. 25      | (Audit log — not a rule)        |  —            |

---

## Rule Type Definitions

### `required`
Field must be non-null and non-empty. The `ruleValue` stores the DB table name. If the field is `NULL` or empty string, the validation engine raises an issue of the configured severity.

### `format`
Field value must match a regex pattern or named format shorthand.
- **LEI codes**: `^[A-Z0-9]{18}[0-9]{2}$` — exactly 20 uppercase alphanumeric chars with numeric last 2
- **Dates**: shorthand `date` — checks the value parses as a valid ISO date
- **Min-length strings**: `^.{N,}$` — ensures narrative fields have sufficient content

### `dropdown`
Field value must exist as an entry in a named reference table. `ruleValue` format: `table.column`  
Reference tables used: `countries.code`, `currencies.code`, `entity_types.id`, `criticality_levels.id`, `reliance_levels.id`, `data_sensitivity_levels.id`, `ict_service_types.id`, `provider_person_types.id`

### `range`
Field value must fall within a numeric boundary. `ruleValue` format: `min|max` (empty side = no bound)  
Examples: `0|` (non-negative), `1|3650` (1 to 3650 days), `0|10080` (0 to 10080 minutes = 1 week)

### `fk_exists`
A foreign key reference must resolve to an existing record. `ruleValue` format: `source_table.column→target_table.column`  
Example: `contractual_arrangements.provider_id→ict_providers.id`

### `cross-field`
A logical comparison between two fields on the same record. `ruleValue` format: `table.fieldA>table.fieldB`  
Example: `contractual_arrangements.end_date>contractual_arrangements.start_date` — end must be after start.

### `conditional`
Field becomes required based on the value of another field. `ruleValue` format: `table.fieldA=value→fieldB.required`  
Example: `ict_service_assessments.is_substitutable=false→substitution_reason.required`

---

## State Machine and Issue Lifecycle

Unlike previous iterations that were stateless, the validation engine permanently stores results in the database and provides a collaborative remediation workflow.

### Tables

1. `validation_rules` — 196 rule definitions (seeded via `prisma/seed.ts`)
2. `validation_runs` — Logs every execution batch (timestamp, total errors/warnings, DORA score)
3. `validation_issues` — Stateful per-record issues; implements 5-state lifecycle

### Workflow Lifecycle (Status field)

```
OPEN → [Analyst flags + comment] → FLAGGED → [Editor submits fix note] → WAITING_APPROVAL
                                                                              ↓          ↓
                                                                  [Analyst approves]  [Analyst rejects]
                                                                       RESOLVED           FLAGGED (loop)

[Rule no longer fires on re-run] → FIXED  (auto-closed by engine)
```

Every transition is recorded in `audit_logs` with the user, timestamp, and old/new state.

### Scoring

The application calculates a real-time **DORA Compliance Score** per validation run:

```
doraScore = (totalRulePassCount / totalRuleCheckCount) × 100
```

Stored on `validation_runs.dora_score`. Displayed on the dashboard and drives the export pre-flight gate.

---

## Template Coverage Detail

### RT.01.01 — Entity Maintaining Register (`financial_entities`)
14 rules: LEI required + format, name required, country required + dropdown, entity_type required + dropdown, integration_date required + format, total_assets required + range, deletion_date cross-field, parent_entity_id fk_exists

### RT.01.02 — Financial Entities in Scope (`financial_entities`)
12 rules: LEI required + format, name required, country required, total_assets range, currency required + dropdown, deletion_date format, entity_type required + dropdown, integration_date required

### RT.01.03 — Branches (`branches`)
7 rules: name required, country required + dropdown, financial_entity_id required + fk_exists, branch_code required + format

### RT.02.01 — Contracts General (`contractual_arrangements`)
14 rules: contract_reference required + format, start_date required + format, end_date format, contract_type required, currency dropdown, annual_cost required (conditional for critical) + range, reliance_level required + fk_exists, ict_service_type fk_exists, service_description required, renewal_terms required (WARNING)

### RT.02.02 — Contracts Specific (`contractual_arrangements`)
24 rules: financial_entity_id required + fk_exists, provider_id required + fk_exists, governing_law_country required + dropdown + cross-field, service_country required + dropdown, data_sensitivity required + dropdown + fk_exists, termination_notice_period required + range, ict_service_type required, provided_by_contractor required, data_storage required, subcontractor_provider conditional + fk_exists, storage_location dropdown, annual_cost range, subcontractor cross-field

### RT.03.01 — Group Coverage (`contract_entities`)
4 rules: contract_id required + fk_exists, financial_entity_id required + fk_exists

### RT.04.01 — Entities Using Services (`entities_using_services`)
4 rules: contract_id required + fk_exists, financial_entity_id required + fk_exists

### RT.05.01 — ICT Providers (`ict_providers`)
19 rules: provider_code required, lei required + format, legal_name required, latin_name required (WARNING), person_type required + dropdown, headquarters_country required + dropdown, ultimate_parent_lei format (WARNING), currency required + dropdown, annual_cost range (WARNING), parent_provider fk_exists, nace_code required (WARNING), intra_group_flag required, parent_provider conditional, legal_name format, latin_name conditional

### RT.05.02 — ICT Supply Chain (`ict_supply_chain`)
8 rules: contract_id required, provider_id fk_exists, parent_chain_id fk_exists, service_type required + fk_exists, supply_rank required + range (1–20)

### RT.06.01 — Business Functions (`business_functions`)
19 rules: financial_entity_id required + fk_exists, function_identifier required + format, function_name required + format, criticality_level required + dropdown, last_assessment_date required + format, rto required + range + conditional, rpo required + conditional + cross-field, impact_discontinuation required + format, criticality_reason required (WARNING), licensed_activity conditional

### RT.07.01 — ICT Service Assessments (`ict_service_assessments`)
20 rules: contract_id required, provider_id required + fk_exists, is_substitutable required, substitution_reason conditional + format, last_audit_date required + format, next_review_date required + format + cross-field, exit_plan_exists required + cross-field, reintegration_possible required, discontinuation_impact required + format, alternative_providers_exist required, assessment_status required, trigger_reason required (WARNING), exit_plan conditional

### RT.08 — Exit Strategies (`exit_strategies`)
10 rules: contract_id required, assessment_id fk_exists (WARNING), fallback_provider conditional (WARNING), exit_trigger required + format (min 10 chars), exit_strategy required + format (min 20 chars), contract cross-field, assessment conditional, exit_trigger cross-field

### RT.05 (ICT Services internal register) — `ict_services`
13 rules: service_name required + format, service_type required + fk_exists, criticality_level required + dropdown + fk_exists, data_sensitivity required + dropdown + fk_exists, service_description required (WARNING), provider_id fk_exists, criticality cross-field

### RT.09.01 — Concentration Risk (`RiskService`)
0 row-level rules seeded. Export is driven by service-layer aggregation. Advanced concentration threshold rules (e.g. flagging if >50% of critical functions rely on one provider) are deferred to future iteration.

### Date Boundary Rules (VR_227–VR_236)
10 `date_boundary` rules ensure that all date fields across RT.01–RT.08 are on or after the DORA effective date of **17 January 2025** (start_date, end_date, integration_date, last_audit_date, next_review_date, last_assessment_date, created_at). All fire as WARNING severity.

### Uniqueness Rules (VR_237–VR_244)
8 `uniqueness` rules detect duplicate primary identifiers within the same tenant: `lei` (financial_entities), `contract_reference` (contractual_arrangements), `provider_code` (ict_providers), `lei` (ict_providers), `function_identifier` (business_functions), `branch_code` (branches), `contract_id` (ict_supply_chain, exit_strategies).

### Aggregate Rules (VR_245–VR_250)
6 `aggregate` rules fire a single tenant-level issue if minimum presence requirements are not met: at least 1 ICT provider (ERROR), 1 financial entity (ERROR), 1 contractual arrangement (ERROR), 1 business function (WARNING), 1 ICT service assessment (WARNING), 1 exit strategy (WARNING).

---

## Future Coverage Gap (Deferred to Future Work)

| Category | Examples | Count Estimate |
|----------|----------|---------------|
| Advanced inter-template cross-checks | Verify `function_identifier` in RT.06 corresponds to `contract_reference` in RT.02 | ~50 |
| RT.09 advanced rules | Complex thresholds for concentration risk | ~30 |
| **Total gap** | | **~80** |
