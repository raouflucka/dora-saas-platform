# DORA SaaS Platform — Data Dictionary

**Last Updated**: 2026-04-19 | Version 5.0  
**Basis**: `backend/prisma/schema.prisma` (live codebase audit)  
**Purpose**: Maps every core PostgreSQL model to its fields, DORA Article, and EBA RoI template column code.

---

## 1. Reference / Lookup Tables (Shared — No Tenant Isolation)

### `countries`
| Field | Type | Description |
|-------|------|-------------|
| `code` | CHAR(2) PK | ISO 3166-1 alpha-2 country code |
| `name` | VARCHAR(100) | Country name |

### `currencies`
| Field | Type | Description |
|-------|------|-------------|
| `code` | CHAR(3) PK | ISO 4217 currency code |
| `name` | VARCHAR(100) | Currency name |

### `entity_types`
| Field | Type | Description |
|-------|------|-------------|
| `id` | SERIAL PK | — |
| `type_name` | VARCHAR(100) | EBA-defined financial entity type (e.g. Credit Institution, Investment Firm) |

### `criticality_levels`
| Field | Type | Description |
|-------|------|-------------|
| `id` | SERIAL PK | — |
| `level_name` | VARCHAR(50) | Critical / Important / Not Critical |

### `reliance_levels` / `data_sensitivity_levels` / `ict_service_types` / `provider_person_types`
Standard EBA DPM reference tables. See `schema.prisma` for full field lists.

---

## 2. System / Security Tables

### `tenants`
| Field | Type | DORA / EBA Mapping |
|-------|------|--------------------|
| `id` | UUID PK | — |
| `name` | VARCHAR(255) | Tenant SaaS label (not the reporting entity name) |
| `lei` | CHAR(20) UNIQUE | Tenant-level LEI (optional at tenant level — use FinancialEntity LEI for reporting) |
| `country` | CHAR(2) | Establishment country |
| `competent_authority` | VARCHAR(100) | EBA RT.01.01.0050 — supervising NCA |

### `users`
| Field | Type | Security Notes |
|-------|------|----------------|
| `id` | UUID PK | — |
| `tenant_id` | UUID FK | RLS-protected |
| `email` | VARCHAR(255) UNIQUE | Login identifier |
| `password_hash` | TEXT | bcrypt, 10 salt rounds |
| `role_id` | INT FK → `user_roles` | ADMIN / ANALYST / EDITOR |
| `refresh_token_hash` | TEXT | bcrypt hash of 64-byte cryptographic random token; rotated on every use |
| `refresh_token_expires` | TIMESTAMP | TTL for refresh token (typically 7 days) |
| `reset_token` | TEXT | Password reset token (raw, short-lived) |
| `reset_token_expires` | TIMESTAMP | Password reset expiry |

### `audit_logs`
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID PK | — |
| `tenant_id` | UUID | Multi-tenant scoping |
| `user_id` | UUID | Acting user |
| `action_type` | VARCHAR(50) | CREATE / UPDATE / DELETE / ISSUE_FLAGGED / ISSUE_APPROVED etc. |
| `table_name` | VARCHAR(100) | Affected entity |
| `record_id` | UUID | Affected record |
| `old_values` | JSONB | Pre-change snapshot (secrets sanitised) |
| `new_values` | JSONB | Post-change snapshot |
| `created_at` | TIMESTAMP | Immutable timestamp |

---

## 3. Core DORA Domain Tables

### `financial_entities` — EBA RT.01.01 / RT.01.02

Maps to DORA Art. 28 and EBA ITS Annex I (RT.01).

| Field | Type | DORA / EBA Mapping |
|-------|------|--------------------|
| `id` | UUID PK | — |
| `tenant_id` | UUID FK | RLS policy key |
| `name` | VARCHAR(255) | EBA RT.01.01 — col 0030: Entity name |
| `lei` | CHAR(20) | EBA RT.01.01 — col 0010: LEI (GLEIF format: 18 alphanumeric + 2 numeric check digits) |
| `entity_type_id` | INT FK | EBA RT.01.01 — col 0050: Entity type (DPM code list) |
| `country` | CHAR(2) | EBA RT.01.01 — col 0040: Country of establishment (ISO 3166-1) |
| `currency` | CHAR(3) | EBA RT.01.02 — col 0060: Reporting currency (ISO 4217) |
| `parent_entity_id` | UUID (self-FK) | EBA RT.01.01 — col 0020: Parent entity LEI reference |
| `integration_date` | DATE | EBA RT.01.01 — col 0120: Date entity entered register scope |
| `deletion_date` | DATE | EBA RT.01.02 — col 0130: Date entity exited register scope |
| `total_assets` | DECIMAL | DORA Art. 4: Proportionality threshold |
| `competent_authority` | VARCHAR(100) | EBA RT.01.01 — col 0050: Supervising NCA |

### `branches` — EBA RT.01.03

| Field | Type | DORA / EBA Mapping |
|-------|------|--------------------|
| `id` | UUID PK | — |
| `tenant_id` | UUID FK | RLS policy key |
| `financial_entity_id` | UUID FK | Parent entity |
| `name` | VARCHAR(255) | EBA RT.01.03 — Branch name |
| `country` | CHAR(2) | EBA RT.01.03 — Branch country |
| `branch_code` | VARCHAR(20) | EBA RT.01.03 — Internal branch identifier |

### `ict_providers` — EBA RT.05.01

Tracks ICT third-party service providers per DORA Art. 28(1).

| Field | Type | DORA / EBA Mapping |
|-------|------|--------------------|
| `id` | UUID PK | — |
| `tenant_id` | UUID FK | RLS policy key |
| `provider_code` | VARCHAR(100) | EBA RT.05.01 — col B_09.01: Provider internal code |
| `legal_name` | VARCHAR(255) | EBA RT.05.01 — col B_09.02: Legal name |
| `latin_name` | VARCHAR(255) | EBA RT.05.01 — col B_09.02a: Latin alphabet name |
| `lei` | CHAR(20) | EBA RT.05.01 — col B_09.03: Provider LEI |
| `person_type_id` | INT FK | EBA RT.05.01 — col B_09.06: Legal / Natural person |
| `headquarters_country` | CHAR(2) | EBA RT.05.01 — col B_09.05: Headquarters country |
| `nace_code` | VARCHAR(10) | EBA RT.05.01 — col B_09.04: NACE economic sector code |
| `intra_group_flag` | BOOLEAN | EBA RT.05.01 — col B_09.07: Is intra-group entity |
| `ultimate_parent_lei` | CHAR(20) | EBA RT.05.01 — col B_09.08: Ultimate parent group LEI |
| `parent_provider_id` | UUID (self-FK) | Group hierarchy — links intra-group to parent |
| `currency` | CHAR(3) | Reporting currency |
| `annual_cost` | DECIMAL | Total annual spend on this provider |
| `competent_authority` | VARCHAR(100) | EBA RT.05.01 — col B_09.11: Supervising authority |

### `contractual_arrangements` — EBA RT.02.01 / RT.02.02 / RT.09.01

The central hub of the DORA data model. Each arrangement links a financial entity to an ICT provider for a specific ICT service. DORA Art. 30 mandates specific contractual provisions.

| Field | Type | DORA / EBA Mapping |
|-------|------|--------------------|
| `id` | UUID PK | — |
| `tenant_id` | UUID FK | RLS policy key |
| `contract_reference` | VARCHAR(255) UNIQUE | EBA RT.02.01 — col B_05.01: Contract identifier |
| `financial_entity_id` | UUID FK | EBA RT.02.02 — col B_05.03: Reporting entity |
| `provider_id` | UUID FK | EBA RT.02.02 — col B_05.02: ICT provider |
| `ict_service_type_id` | INT FK | EBA RT.02.01 — col B_05.04: ICT service type category |
| `contract_type` | VARCHAR(100) | EBA RT.02.01 — col B_05.05: Contract type |
| `service_description` | TEXT | EBA RT.02.01 — col B_05.06: Service description |
| `start_date` | DATE | EBA RT.02.01 — col B_05.07: Contract start |
| `end_date` | DATE | EBA RT.02.01 — col B_05.08: Contract end / planned expiry |
| `governing_law_country` | CHAR(2) | EBA RT.02.02 — col B_05.10: Jurisdiction |
| `service_country` | CHAR(2) | EBA RT.02.02 — col B_05.11: Service delivery country |
| `data_storage` | BOOLEAN | EBA RT.02.02 — col B_05.14: Personal data stored? |
| `storage_location` | CHAR(2) | EBA RT.02.02 — col B_05.15: Storage country |
| `processing_location` | CHAR(2) | EBA RT.02.02 — col B_05.16: Processing country |
| `data_sensitivity_id` | INT FK | EBA RT.02.02 — col B_05.13: Data sensitivity level |
| `reliance_level_id` | INT FK | EBA RT.02.02 — col B_05.18: Level of reliance |
| `termination_notice_period` | INT | DORA Art. 28(8): Days notice required for termination |
| `annual_cost` | DECIMAL | EBA RT.02.01 — col B_05.21: Annual contract cost |
| `provided_by_contractor` | BOOLEAN | EBA RT.02.02 — col B_05.20: Direct provision flag |
| `provided_by_subcontractor` | BOOLEAN | EBA RT.02.02 — col B_05.22: Subcontracted flag |
| `subcontractor_provider_id` | UUID FK (optional) | EBA RT.02.02 — col B_05.23: Subcontracting provider |
| `renewal_terms` | TEXT | Art. 30: Renewal/review terms |
| `currency` | CHAR(3) | EBA RT.02.01 — col B_05.25: Cost currency |

### `business_functions` — EBA RT.06.01

Critical or Important Business Functions (CIBF) linked to ICT services (DORA Art. 28§4).

| Field | Type | DORA / EBA Mapping |
|-------|------|--------------------|
| `id` | UUID PK | — |
| `tenant_id` | UUID FK | RLS policy key |
| `financial_entity_id` | UUID FK | EBA RT.06.01 — col B_04.03: Entity |
| `function_identifier` | VARCHAR(50) | EBA RT.06.01 — col B_04.01: Internal function ID |
| `function_name` | VARCHAR(255) | EBA RT.06.01 — col B_04.02: Function description |
| `criticality_level_id` | INT FK | EBA RT.06.01 — col B_04.04: Criticality assessment |
| `criticality_reason` | TEXT | Justification narrative |
| `licensed_activity` | VARCHAR(255) | EBA RT.06.01 — col B_04.05: Licensed activity |
| `rto` | INT | DORA Art. 11: Recovery Time Objective (minutes) |
| `rpo` | INT | DORA Art. 11: Recovery Point Objective (minutes) |
| `impact_discontinuation` | TEXT | EBA RT.06.01 — col B_04.08: Impact analysis |
| `last_assessment_date` | DATE | EBA RT.06.01 — col B_04.09: Last criticality assessment date |

### `ict_services` — Internal ICT Service Asset Register

An internal register of ICT service products offered by providers (e.g., "AWS S3", "Azure AD"). Not a direct EBA RT column table, but supports exit strategy traceability and RT.05 reporting.

| Field | Type | Description |
|-------|------|-|
| `id` | UUID PK | — |
| `tenant_id` | UUID FK | RLS policy key |
| `service_name` | VARCHAR(255) | Service product name |
| `service_type_id` | INT FK | ICT service category |
| `criticality_level_id` | INT FK | Criticality classification |
| `data_sensitivity_id` | INT FK | Data classification |
| `service_description` | TEXT | Free-text description |
| `provider_id` | UUID FK | Offering provider |

### `ict_supply_chain` — EBA RT.05.02

Multi-level supply chain tree. `supply_rank=1` = direct subcontractor of the main provider; `parent_chain_id=null` = top of chain. Self-referencing via `parent_chain_id`.

| Field | Type | DORA / EBA Mapping |
|-------|------|--------------------|
| `id` | UUID PK | — |
| `contract_id` | UUID FK | Parent contract |
| `provider_id` | UUID FK | EBA RT.05.02: Subcontractor provider |
| `parent_chain_id` | UUID (self-FK) | Who hired this subcontractor (null = main provider) |
| `service_type_id` | INT FK | EBA RT.05.02: Service type provided |
| `supply_rank` | INT | Tier depth: 1 = first sub, 2 = second sub, etc. |

### `ict_service_assessments` — EBA RT.07.01

Substitutability and resilience assessments per DORA Art. 28§5.

| Field | Type | DORA / EBA Mapping |
|-------|------|--------------------|
| `id` | UUID PK | — |
| `tenant_id` | UUID FK | RLS policy key |
| `contract_id` | UUID FK | Assessed contract |
| `provider_id` | UUID FK | Assessed provider |
| `is_substitutable` | BOOLEAN | EBA RT.07.01 — col B_07.01: Can be substituted? |
| `substitution_reason` | TEXT | EBA RT.07.01 — col B_07.02: Reason if not substitutable |
| `last_audit_date` | DATE | EBA RT.07.01 — col B_07.03: Most recent audit date |
| `next_review_date` | DATE | EBA RT.07.01: Planned next review |
| `exit_plan_exists` | BOOLEAN | EBA RT.07.01 — col B_07.04: Exit plan in place? |
| `reintegration_possible` | BOOLEAN | EBA RT.07.01 — col B_07.06: Can service be reintegrated? |
| `discontinuation_impact` | TEXT | EBA RT.07.01 — col B_07.07: Impact if provider fails |
| `alternative_providers_exist` | BOOLEAN | EBA RT.07.01 — col B_07.08: Alternative identified? |
| `assessment_status` | VARCHAR(50) | Assessment workflow status |
| `trigger_reason` | TEXT | Reason this assessment was triggered |

### `exit_strategies` — EBA RT.08

Exit plans for ICT service dependencies per DORA Art. 28§8.

| Field | Type | DORA / EBA Mapping |
|-------|------|--------------------|
| `id` | UUID PK | — |
| `tenant_id` | UUID FK | RLS policy key |
| `contract_id` | UUID FK | EBA RT.08: Linked contract |
| `assessment_id` | UUID FK (optional) | Linked substitutability assessment |
| `exit_trigger` | TEXT | DORA Art. 28(8): Condition(s) triggering exit |
| `exit_strategy` | TEXT | EBA RT.08: Migration / termination plan |
| `fallback_provider_id` | UUID FK (optional) | EBA RT.08: Named alternative provider |

---

## 4. Junction Tables

| Table | Links | EBA Template |
|-------|-------|--------------|
| `contract_entities` | `contractual_arrangements` ↔ `financial_entities` | RT.03.01: Group-level coverage |
| `contract_providers` | `contractual_arrangements` ↔ `ict_providers` | RT.03.01: Multi-provider contracts |
| `entities_using_services` | `contractual_arrangements` ↔ `financial_entities` | RT.04.01: Entities using services |
| `function_ict_dependencies` | `business_functions` ↔ `contractual_arrangements` | RT.06.01: Function-to-contract mapping |
| `exit_strategy_services` | `exit_strategies` ↔ `ict_services` | RT.08: Services covered by exit plan |

---

## 5. Validation / Compliance Tables

| Table | Purpose |
|-------|---------|
| `validation_rules` | 220 EBA rule definitions (VR_01–VR_250). Each row declares `templateName`, `fieldName`, `ruleType`, `ruleValue`, `errorMessage`, `severity`, `doraArticle`. Rules are data — editable without redeployment. |
| `validation_runs` | One row per execution of `POST /validation/run`. Records timestamp, `dora_score`, total errors, total warnings. |
| `validation_issues` | One row per rule × record violation. Implements 5-state lifecycle: OPEN → FLAGGED → WAITING_APPROVAL → RESOLVED (or FIXED when underlying data is corrected). |
| `notifications` | Cross-role event notifications with deep-links to the affected record. |
| `comments` | Polymorphic threaded comments on any entity (used in validation remediation workflow). |
