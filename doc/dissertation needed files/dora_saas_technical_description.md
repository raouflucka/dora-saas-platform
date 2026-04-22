# DORA SaaS Platform — Precise Technical Description
## For Dissertation Chapter 4 (System Architecture) and Chapter 5 (Implementation)

**Prepared by**: Technical Audit of Live Codebase  
**Date**: 19 April 2026  
**Codebase Snapshot Version**: 5.0  
**Basis**: Direct inspection of `schema.prisma`, `app.module.ts`, `validation.service.ts`, `roi-export.service.ts`, `audit.interceptor.ts`, `auth.module.ts`, `tenant-isolation.middleware.ts`, `rls_policies.sql`, `docker-compose.yml`, and all frontend pages, together with the documentation files in `/doc/`.

---

## 1. High-Level System Overview

### 1.1 Purpose and Scope

The DORA SaaS platform is a multi-tenant RegTech web application that enables Irish Small and Medium Enterprise (SME) financial entities to build, manage, and export a structured **Register of Information (RoI)** in compliance with the Digital Operational Resilience Act (EU 2022/2554, DORA), which became effective on 17 January 2025.

The system addresses the requirements of DORA Chapter V (Articles 28–30) and the associated technical standards issued by the European Banking Authority (EBA), specifically the **EBA ITS on Registers of Information** (EBA/ITS/2023/02), which defines the mandatory template formats RT.01 through RT.09.

The platform serves three distinct functions:

1. **Living CRUD Register**: A continuously maintained database of financial entities, ICT providers, contractual arrangements, business functions, supply chain relationships, service assessments, and exit strategies. All data entry is performed through role-restricted web forms with field-level validation.

2. **Validation Engine**: A rule-based engine that checks all stored data against EBA Draft Validation Rules (`Draft_validation_rules_for_DORA_reporting_of_RoI.xlsx`). The engine identifies errors, assigns severity levels, and manages a multi-step remediation workflow across three user roles.

3. **RoI Export**: A pre-flight-gated export subsystem that generates either an Excel workbook (one worksheet per template) or an EBA-formatted OIM-CSV package (ZIP archive containing one CSV per template plus a `metadata.json` descriptor) intended for official submission to the Central Bank of Ireland (CBI).

### 1.2 EBA Template Coverage

The system explicitly supports the following EBA sub-templates, as declared in `roi-export.service.ts`:

| Code | Description | Source Tables |
|------|-------------|--------------|
| RT.01.01 | Entity maintaining the register | `financial_entities`, `tenants` |
| RT.01.02 | Financial entities in scope | `financial_entities` |
| RT.01.03 | Branches | `branches` |
| RT.02.01 | Contractual arrangements (general) | `contractual_arrangements` |
| RT.02.02 | Contractual arrangements (specific) | `contractual_arrangements` + related |
| RT.03.01 | Group-level contract coverage (Art. 29) | `contract_entities`, `contract_providers` |
| RT.04.01 | Entities and branches using services (Art. 29) | `entities_using_services` |
| RT.05.01 | ICT third-party service providers | `ict_providers` |
| RT.05.02 | ICT supply chain | `ict_supply_chain` |
| RT.06.01 | Critical and important business functions | `business_functions` |
| RT.07.01 | ICT service assessments | `ict_service_assessments` |
| **RT.08.01** | **Exit strategies** | **`exit_strategies`** |
| **RT.09.01** | **Concentration risk** | **`contractual_arrangements`** |

The `SUPPORTED_TEMPLATES` array in `roi-export.service.ts` now contains **13 sub-templates** (RT.01.01 through RT.09.01).
All operational data is mapped against the EBA structural schema and validated using 220 seeded EBA validation rules covering mandatory fields, data types, and referential integrity across templates RT.01 through RT.09.

### 1.3 Target Users and Roles

The system defines three operational roles, persisted in the `user_roles` reference table:

| Role | Responsibilities |
|------|-----------------|
| **ADMIN** | Tenant and user management; read-only access to all compliance data; RoI export; audit log review; concentration risk visualisation |
| **ANALYST** | Triggering validation runs; flagging issues for Editor remediation; approving or rejecting Editor fixes; reading all data modules |
| **EDITOR** | Data entry into ICT Providers, ICT Services, Contractual Arrangements, and Exit Strategies; submitting fixes for validation issues flagged by Analyst |

The `AUDITOR` role name was renamed to `EDITOR` in a previous session to better reflect the actual workflow responsibilities.

### 1.4 Architecture Summary

The DORA SaaS platform is a **three-tier, multi-tenant SaaS web application**:

- **Presentation tier**: React 19 single-page application served by Vite 8, running on port 8000. Communicates exclusively via REST/JSON to the backend API.
- **Application tier**: NestJS 11 (Node.js 22) REST API, serving all business logic, authentication, validation, and export. Runs on port 3000. API routes are versioned under `/api/v1/`.
- **Data tier**: PostgreSQL 16 (Docker image `postgres:16-alpine`) with the logical database `DORA_DB`. Object-relational mapping is managed entirely by Prisma 7.5.0 using the `@prisma/adapter-pg` pg adapter.

Additional components include:

- A custom **MailerModule** using nodemailer 8.0.4 for password-reset emails.
- A global **AuditInterceptor** that writes to `audit_logs` on all mutating HTTP requests.
- A **ThrottlerModule** providing global rate limiting.
- An **archiver**-based ZIP generator for the XBRL OIM-CSV package.

**Deployment**: A `docker-compose.yml` file defines four services — `postgres`, `backend`, `frontend`, and `prisma-studio` — connected via an internal bridge network (`dora_network`). This is currently configured for local development. No cloud infrastructure, load balancing, or managed database services are configured. The JWT secret is passed via environment variable `JWT_SECRET`; the compose file includes a fallback default value that is explicitly noted as requiring replacement for production use.

**Security hardening** (19 April 2026): PostgreSQL Row-Level Security (RLS) is applied to all 20 tenant-bearing tables via `prisma/rls_policies.sql`. The `TenantIsolationMiddleware` (`src/common/middleware/tenant-isolation.middleware.ts`) is registered globally in `AppModule` and sets the `app.current_tenant_id` PostgreSQL session variable at the start of every NestJS request, activating all RLS policies. JWT refresh token rotation (64-byte cryptographic random, bcrypt-hashed, cleared on logout and password reset) is fully implemented.

---

## 2. Backend Architecture and Modules

### 2.1 Technology Stack (Exact Versions)

| Component | Library | Version |
|-----------|---------|---------|
| Framework | `@nestjs/common`, `@nestjs/core` | 11.0.1 |
| ORM | `@prisma/client`, `@prisma/adapter-pg` | 7.5.0 |
| Authentication | `@nestjs/jwt`, `passport-jwt`, `passport` | 11.0.2 / 4.0.1 / 0.7.0 |
| Password hashing | `bcrypt` | 6.0.0 |
| Input validation | `class-validator`, `class-transformer` | 0.14.4 / 0.5.1 |
| API documentation | `@nestjs/swagger` | 11.2.6 |
| Rate limiting | `@nestjs/throttler` | 6.5.0 |
| Security headers | `helmet` | 8.1.0 |
| Excel generation | `exceljs` | 4.4.0 |
| ZIP generation | `archiver` | 7.0.1 |
| Email | `nodemailer` | 8.0.4 |
| Cookie parsing | `cookie-parser` | 1.4.7 |

### 2.2 Active NestJS Modules

The following modules are registered in `AppModule` (`src/app.module.ts`):

#### PrismaModule
Provides the global `PrismaService` database connection singleton. All other modules inject `PrismaService` directly.

#### AuthModule
Handles authentication. Implements five public endpoints: login (POST), register (POST), forgot-password (POST), reset-password (POST), and **refresh** (POST — rotates access + refresh token pair). Also provides logout (POST, JWT-guarded) and GET /auth/me. Uses `@nestjs/passport` with `passport-jwt`. Access tokens are short-lived (15-minute expiry). Refresh tokens are long-lived (7-day), stored as bcrypt hashes in `users.refresh_token_hash`, and rotated on every successful use. Token revocation is implemented via logout, which clears the stored hash.

#### UsersModule  
Provides `UsersService.findByEmail()` and `UsersService.create()`, used internally by `AuthModule`. Has no public controller endpoints.

#### FinancialEntitiesModule
Full CRUD for `financial_entities` and `branches` (sub-resource). Enforces ADMIN-only writes on financial entities. Branch creation is available to ANALYST. Maps to EBA RT.01.01, RT.01.02, RT.01.03.

#### IctProvidersModule
Full CRUD for `ict_providers`. Write operations restricted to EDITOR and ADMIN. Supports parent hierarchy (`parent_provider_id` self-referencing FK) and exposes all EBA RT.05.01 fields: `lei`, `nace_code`, `ultimate_parent_lei`, `intra_group_flag`, `competent_authority`.

#### ContractualArrangementsModule
The central hub module. Full CRUD for `contractual_arrangements`. Manages relations to financial entities, providers, ICT service types, governing law countries, data sensitivity levels, and reliance levels. Exposes nested arrays of `ictDependencies` (business function links), `contractEntities`, `contractProviders`, and `entitiesUsingServices`. Maps to Art. 28§2, Art. 30, EBA RT.02.01/02.

#### ContractEntitiesModule
Dedicated junction module for the `contract_entities` table (one contract → multiple financial entities, Art. 29). Exposes `POST /contract-entities` and `DELETE /contract-entities/:contractId/:entityId`. Restricted to ANALYST and ADMIN for writes. Previously marked as orphaned; now has a full controller and service.

#### ContractProvidersModule
Dedicated junction module for `contract_providers` (one contract → multiple subcontractor providers). Exposes `POST /contract-providers` and `DELETE /contract-providers/:contractId/:providerId`. Write access restricted to ANALYST and ADMIN.

#### FunctionsModule
Full CRUD for `business_functions`. Manages `function_ict_dependencies` as sub-resource via `POST /functions/:id/dependencies` and `DELETE /functions/:id/dependencies/:contractId`. Restricted to ANALYST for writes. Maps to Art. 28§4, EBA RT.06.01.

#### RiskAssessmentModule
Full CRUD for `ict_service_assessments`. Links each assessment to a `contractual_arrangement` and an `ict_provider`. Contains assessment workflow fields: `isSubstitutable`, `substitutionReason`, `exitPlanExists`, `reintegrationPossible`, `discontinuationImpact`, `alternativeProvidersExist`, `alternativeProviderReference`. Maps to Art. 28§5, EBA RT.07.01.

#### IctServicesModule
Full CRUD for `ict_services`. Associates each service with a provider, service type, criticality level, and data sensitivity level. Maps to EBA RT.05.01 (service-level abstraction within a provider offering).

#### IctSupplyChainModule
Full CRUD for `ict_supply_chain`. Each row represents a subcontractor relationship within a contract's supply chain, identified by `contractId`, `providerId` (the subcontractor), `parentChainId` (the entity that hired them, nullable for the top-level provider), `serviceTypeId`, and `supplyRank` (depth level). Exposes a recursive hierarchy query at `GET /ict-supply-chain/chain/:contractId`. Write operations restricted to ANALYST and ADMIN. Maps to Art. 28§3, EBA RT.05.02.

#### ExitStrategiesModule
Full CRUD for `exit_strategies`. Each strategy is linked to a contract, an optional assessment (`assessmentId`), an `exitTrigger`, an `exitStrategy` narrative, and an optional `fallbackProviderId`. Supports `exit_strategy_services` junction for linking multiple ICT services to a strategy. Maps to Art. 28§8, EBA RT.08.

#### ValidationModule
The rule-based validation engine. Contains `ValidationController` (endpoints for triggering runs, fetching history, and managing issue lifecycle) and `ValidationService` (rule executor, state machine, DORA score computation). Described in detail in Section 6.

#### RoiExportModule
Generates Excel workbooks and XBRL OIM-CSV ZIP archives from the live database. Contains a pre-flight gate that reads the latest `ValidationRun` and blocks export if unresolved ERROR-severity issues exist. Described in Section 7.

#### TenantsModule
ADMIN-only management of the `tenants` table. Allows creation and management of tenant records.

#### AuditLogModule
Provides `AuditLogService.write()`. The actual writing is performed by the global `AuditInterceptor` (registered as `APP_INTERCEPTOR`), which fires on all successful POST/PATCH/PUT/DELETE requests to whitelisted tables.

#### NotificationsModule
Creates and delivers role-targeted notifications. Each notification carries a `tenantId`, optional `userId`, or `roleName` (for role-wide broadcast), `title`, `message`, `link` (deep-link URL), and `isRead` flag. Used by the Validation Engine to notify Editors when issues are flagged, and Analysts when fixes are submitted.

#### CommentsModule
Provides polymorphic threaded comments attached to any entity by `(entityType, entityId)` combination. Scoped by `tenantId`.

#### DashboardModule
Provides aggregated KPI data for the role-adaptive dashboard: DORA compliance score, open issue counts, recent validation run summaries, and ICT provider concentration metrics.

#### RiskModule
Provides concentration risk data for the Admin dashboard: provider-level aggregation of contract counts and annual cost totals, flagging providers that appear across multiple contracts as potential concentration risks.

#### MailerModule
Custom module wrapping nodemailer. Used exclusively for the password-reset flow (sends a tokenised email link).

#### ThrottlerModule
Global rate limiter configured at `10 requests per 60 seconds`. Applied to all routes via the default throttler guard.

### 2.3 API Style

All endpoints are REST/JSON and versioned under the path prefix `/api/v1/`. The API is documented via Swagger/OpenAPI, accessible at `http://localhost:3000/api/docs`. Swagger documentation is generated automatically by `@nestjs/swagger` from controller decorators.

---

## 3. Database Design and Multi-Tenancy

### 3.1 Database Details

| Parameter | Value |
|-----------|-------|
| RDBMS | PostgreSQL 16 (Docker image: `postgres:16-alpine`) |
| Database name | `DORA_DB` |
| Default user | `postgres` |
| Default password | `1234` (development only) |
| Port | `5432` |
| Connection string | `postgresql://postgres:1234@postgres:5432/DORA_DB?schema=public` |
| Schema management | Prisma 7.5.0 (`db push` for development; no migration history files present) |

### 3.2 Multi-Tenancy Design

Multi-tenancy is implemented at the **application layer** via a `tenant_id` (UUID) column present on all core domain tables and system tables. The isolation mechanism works as follows:

1. **Tenant registration**: A `Tenant` record is created in the `tenants` table with a UUID primary key, name, optional LEI, and country.
2. **User binding**: Every `User` record contains a `tenant_id` FK referencing `tenants.id`. A user belongs to exactly one tenant.
3. **JWT encoding**: Upon login, `AuthService` constructs a JWT payload containing `{ id: userId, email, tenantId, role }`. The `tenantId` is extracted from the user's database record.
4. **Request-level injection**: The `JwtStrategy` populates `request.user` with the decoded JWT payload. Every service method receives `tenantId` from `request.user.tenantId` and appends it as a `WHERE tenant_id = $tenantId` clause to all Prisma queries.
5. **DB-level RLS Enabled**: PostgreSQL Row-Level Security (RLS) is configured and applied via `prisma/rls_policies.sql`. A NestJS middleware injects `app.current_tenant_id` into the Postgres session, enforcing tenant isolation directly at the database kernel layer to prevent cross-tenant leakage.

### 3.3 Database Table Groups and Relationships

#### Reference / Lookup Tables

These tables are seeded at application startup and are never modified by end-user actions. They map directly to EBA ITS code lists:

| Table | EBA Code List Mapping |
|-------|-----------------------|
| `countries` | ISO 3166-1 alpha-2 — used for `governing_law_country`, `headquarters_country`, `branch.country`, etc. |
| `currencies` | ISO 4217 — used for `financial_entities.currency`, `ict_providers.currency` |
| `entity_types` | EBA entity type code list — maps to RT.01.01.0040 / RT.01.02.0040 |
| `criticality_levels` | EBA criticality classifications (Critical / Important / Not Critical) |
| `reliance_levels` | EBA reliance enumeration (Full / Substantial / Moderate / Low) |
| `data_sensitivity_levels` | EBA data sensitivity (Public / Internal / Confidential / Restricted / Secret) |
| `ict_service_types` | EBA ICT service type code list (Cloud IaaS / PaaS / SaaS / Data Analytics / etc.) |
| `provider_person_types` | Legal Person / Natural Person — maps to RT.05.01.0040 |
| `user_roles` | Application-internal role enumeration |

Reference data is served by `ReferenceModule` via `GET /api/v1/reference/*` routes, which the frontend uses to populate all `<select>` dropdowns, ensuring data entry is constrained to valid code list values.

#### System and Security Tables

**`users`**: UUID PK, `tenant_id` FK, `email` (globally unique), `password_hash` (bcrypt, 10 rounds), `full_name`, `role_id` FK → `user_roles`, `reset_token`, `reset_token_expires`, `refresh_token_hash` (bcrypt hash, nullable), `refresh_token_expires` (nullable). One-to-many with `audit_logs`, `comments`, `notifications`.

**`tenants`**: UUID PK, `name`, `lei` (optional, globally unique), `country`, `competent_authority` (VARCHAR 100, nullable — EBA RT.01.01.0050). Parent entity for all domain data.

**`audit_logs`**: UUID PK, `tenant_id`, `user_id` FK, `action_type` (CREATE/UPDATE/DELETE/ISSUE_FLAGGED/ISSUE_MARK_FIXED/ISSUE_APPROVED/ISSUE_REJECTED), `table_name`, `record_id`, `old_values` (JSONB snapshot before mutation), `new_values` (JSONB response body after mutation), `created_at`. Append-only; never updated or deleted.

**`validation_rules`**: UUID PK, `template_name` (e.g. `RT.02`), `field_name` (e.g. `governing_law_country`), `rule_type` (one of: required / format / fk_exists / dropdown / range / cross-field / conditional), `rule_value` (regex, FK spec, or condition expression), `error_message`, `severity` (ERROR/WARNING/INFO), `dora_article`, `is_active`. Seeded from `prisma/seed.ts`.

**`validation_runs`**: UUID PK, `tenant_id`, `executed_at`, `total_errors`, `total_warnings`, `total_info`, `total_rules_executed`, `total_fields_checked`, `total_fields_passing`, `dora_score` (Float), `category_summary` (JSONB breakdown by error category), `results` (JSONB array of `ValidationResult` objects).

**`validation_issues`**: UUID PK, `tenant_id`, `run_id` FK, `rule_id` FK, `record_id` (UUID of the failing record), `table_name`, `field_name`, `analyst_message`, `editor_resolution_note`, `flagged_by` (Analyst userId), `fixed_by` (Editor userId), `fixed_at`, `status` (OPEN/FLAGGED/FIXED/WAITING_APPROVAL/RESOLVED), `created_at`, `resolved_at`. The source of truth for the issue lifecycle state machine.

**`notifications`**: UUID PK, `tenant_id`, optional `user_id`, optional `role_name` (for broadcast to all users of a role), `title`, `message`, `is_read`, `link` (deep-link URL for navigation), `created_at`.

**`comments`**: UUID PK, `tenant_id`, `entity_type` (discriminator string, e.g. "IctProvider"), `entity_id` (UUID), `author_id` FK → `users.id`, `content`, `created_at`, `updated_at`.

#### DORA Domain Tables

**`financial_entities`**: UUID PK, `tenant_id`, `lei` (CHAR(20), globally unique), `name`, `country`, `entity_type_id` FK, `parent_entity_id` (self-referencing FK for group hierarchy), `total_assets`, `currency`, `integration_date`, `deletion_date`. Maps to RT.01.02. The `lei` field is the primary identifier used throughout the system (e.g., referenced in contract export columns).

**`branches`**: UUID PK, `tenant_id`, `financial_entity_id` FK, `branch_code`, `name`, `country`. Maps to RT.01.03. Related to `entities_using_services` for the branch-level service usage (Art. 29).

**`ict_providers`**: UUID PK, `tenant_id`, `provider_code` (unique internal reference), `legal_name`, `latin_name`, `person_type_id` FK, `headquarters_country`, `parent_provider_id` (self-referencing), `annual_cost`, `currency`, `lei` (CHAR(20)), `nace_code`, `ultimate_parent_lei`, `intra_group_flag`, `competent_authority`. All EBA RT.05.01 fields are modelled. IctProviders are linked to contracts as primary providers or subcontractors.

**`contractual_arrangements`**: UUID PK (not tenant-scoped directly; `financial_entity_id` carries the tenant link), `contract_reference` (unique), `financial_entity_id` FK, `provider_id` FK, `ict_service_type_id` FK, `contract_type`, `service_description`, `start_date`, `end_date`, `governing_law_country`, `service_country`, `provided_by_contractor`, `provided_by_subcontractor`, `subcontractor_provider_id` FK, `data_storage`, `storage_location`, `processing_location`, `data_sensitivity_id` FK, `reliance_level_id` FK, `termination_notice_period`, `renewal_terms`, `annual_cost`, `currency`. This is the system's central hub for DORA Art. 30 mandatory contractual provisions (RT.02.02 fields).

**`contract_entities`** (junction): `(contract_id, financial_entity_id)` unique pair. Records which additional financial entities (beyond the primary one on the contract) are party to the arrangement. Maps to RT.03.01 (group-level contract coverage, Art. 29).

**`contract_providers`** (junction): `(contract_id, provider_id)` unique pair. Records subcontractor providers linked to a contract for a given service scope. Used in RT.03.01 provider rows and in the Subcontractors tab of the Contractual Arrangements page.

**`entities_using_services`** (junction): `(contract_id, financial_entity_id, branch_id?)`. Records which financial entity or branch is an end-user of the services provided under a contract (Art. 29). `is_branch` flag distinguishes entity-level from branch-level usage. Maps to RT.04.01.

**`business_functions`**: UUID PK, `tenant_id`, `function_identifier` (unique), `financial_entity_id` FK, `function_name`, `licensed_activity`, `criticality_level_id` FK, `criticality_reason`, `last_assessment_date`, `rto` (integer minutes), `rpo` (integer minutes), `impact_discontinuation`. Maps completely to RT.06.01.

**`function_ict_dependencies`** (junction): `(function_id, contract_id)` unique pair. Establishes the linkage between a business function and the ICT contracts that support it (Art. 28§4 — differentiating critical from non-critical functions). This junction table is the relational backbone of the DORA compliance graph.

**`ict_services`**: UUID PK, `tenant_id`, `provider_id` FK, `service_name`, `service_description`, `service_type_id` FK, `criticality_level_id` FK, `data_sensitivity_id` FK. Represents a named ICT service abstraction offered by a specific provider, independent of any individual contract. Used as a logical asset register.

**`ict_supply_chain`**: UUID PK, `contract_id` FK, `provider_id` FK (the subcontractor), `parent_chain_id` FK (self-referencing — the entity at the level above; NULL for the top-level provider), `service_type_id` FK, `supply_rank` (integer depth). Represents the n-tier subcontracting hierarchy for a given contract. Maps to RT.05.02.

**`ict_service_assessments`**: UUID PK, `tenant_id`, `contract_id` FK, `provider_id` FK, `is_substitutable` (boolean), `substitution_reason` (text, required when `is_substitutable = false` per EBA VR_109), `last_audit_date`, `next_review_date`, `exit_plan_exists` (boolean quick flag), `reintegration_possible`, `discontinuation_impact`, `alternative_providers_exist`, `alternative_provider_reference`, `trigger_reason`, `assessment_status`. Maps to Art. 28§5 and RT.07.01. VR_109 (`substitution_reason` conditionally required) is enforced by the validation engine `conditional` rule type.

**`exit_strategies`**: UUID PK, `tenant_id`, `contract_id` FK, `assessment_id` FK (optional link back to the triggering assessment), `exit_trigger` (text narrative), `exit_strategy` (text narrative), `fallback_provider_id` FK, `created_at`. Junction `exit_strategy_services` links to `ict_services`. Maps to Art. 28§8, RT.08.

### 3.4 Full DORA Compliance Chain

The relational chain from entity to exit strategy can be traced as follows:

```
Tenant
  └── FinancialEntity (lei, entity_type, total_assets)
        ├── Branch (branch_code, country)
        ├── BusinessFunction (function_identifier, criticality_level)    [RT.06]
        │     └── FunctionIctDependency → ContractualArrangement         [RT.06 ↔ RT.02]
        └── ContractualArrangement (contract_reference, start_date, ...)  [RT.02]
              ├── IctProvider (lei, nace_code, ...)                       [RT.05]
              │     └── IctSupplyChain (supply_rank, parent_chain_id)    [RT.05.02]
              ├── ContractEntity → FinancialEntity (Art. 29)             [RT.03]
              ├── ContractProvider → IctProvider (subcontractors)        [RT.03]
              ├── EntitiesUsingService → FinancialEntity / Branch        [RT.04]
              ├── IctServiceAssessment (substitutability, exit_plan)     [RT.07]
              └── ExitStrategy (exit_trigger, fallback_provider)         [RT.08]
```

---

## 4. DORA and EBA Regulatory Mapping

### 4.1 DORA Article to Implementation

| DORA Article | Requirement | Implementation |
|---|---|---|
| Art. 28§1 | Maintain list of ICT third-party providers | `ict_providers` table; `IctProvidersModule`; RT.05.01 export |
| Art. 28§2 | Formal contractual arrangements | `contractual_arrangements`; `ContractualArrangementsModule`; RT.02.01/02 export |
| Art. 28§3 | Register of ICT supply chain subcontractors | `ict_supply_chain`; `IctSupplyChainModule`; RT.05.02 export |
| Art. 28§4 | Identify critical and important business functions | `business_functions` + `function_ict_dependencies`; `FunctionsModule`; RT.06.01 export |
| Art. 28§5 | Assess substitutability and exit plans | `ict_service_assessments` + `exit_strategies`; `RiskAssessmentModule`; RT.07.01 export |
| Art. 28§8 | Document exit strategies | `exit_strategies`; `ExitStrategiesModule`; RT.08.01 export implemented 17 April 2026 |
| Art. 29 | Group-level register (multiple entities per contract) | `contract_entities`, `contract_providers`, `entities_using_services`; RT.03.01/04.01 export |
| Art. 30 | Mandatory contractual provisions | `contractual_arrangements` fields for governing law, data location, notice periods, service type; RT.02.02 export |
| Art. 11 (Art. 4) | Business continuity — recovery objectives | `business_functions.rto`, `business_functions.rpo` fields |
| Art. 25 | Audit and accountability | Global `AuditInterceptor`; `audit_logs` table |

### 4.2 Concrete Field-to-Template Examples

The following demonstrates how database fields map to specific EBA column codes in the export:

| DB Column | EBA Column Code | Template |
|-----------|-----------------|----------|
| `financial_entities.lei` | RT.01.01.0010 / RT.01.02.0010 | RT.01.01, RT.01.02 |
| `financial_entities.name` | RT.01.01.0020 / RT.01.02.0020 | RT.01.01, RT.01.02 |
| `financial_entities.total_assets` | RT.01.02.0110 | RT.01.02 |
| `ict_providers.lei` | RT.05.01.0010 (type = LEI) | RT.05.01 |
| `ict_providers.nace_code` | (enriches RT.05.01 provider identification) | RT.05.01 |
| `ict_providers.ultimate_parent_lei` | RT.05.01.0080 | RT.05.01 |
| `contractual_arrangements.contract_reference` | RT.02.01.0010, RT.02.02.0010 | RT.02 |
| `contractual_arrangements.contract_type` | RT.02.01.0020 | RT.02.01 |
| `contractual_arrangements.governing_law_country` | RT.02.02.0120 | RT.02.02 |
| `contractual_arrangements.termination_notice_period` | RT.02.02.0100 | RT.02.02 |
| `contractual_arrangements.storage_location` | RT.02.02.0150 | RT.02.02 |
| `contractual_arrangements.processing_location` | RT.02.02.0160 | RT.02.02 |
| `business_functions.function_identifier` | RT.06.01.0010 | RT.06.01 |
| `business_functions.rto` | RT.06.01.0090 | RT.06.01 |
| `business_functions.rpo` | RT.06.01.0100 | RT.06.01 |
| `ict_service_assessments.is_substitutable` | RT.07.01.0050 | RT.07.01 |
| `ict_service_assessments.substitution_reason` | RT.07.01.0060 | RT.07.01 |
| `ict_service_assessments.exit_plan_exists` | RT.07.01.0080 | RT.07.01 |
| `ict_supply_chain.supply_rank` | RT.05.02.0050 | RT.05.02 |

### 4.3 Template Coverage Status

| Template | DB Model | API | Frontend | Export |
|----------|----------|-----|----------|--------|
| RT.01 (Financial Entities) | ✅ Full | ✅ | ✅ | ✅ |
| RT.02 (Contracts) | ✅ Full | ✅ | ✅ | ✅ |
| RT.03 (Group Coverage) | ✅ Full | ✅ | ✅ | ✅ |
| RT.04 (Entities Using Services) | ✅ Full | ✅ | ✅ | ✅ |
| RT.05 (ICT Providers + Supply Chain) | ✅ Full | ✅ | ✅ | ✅ |
| RT.06 (Business Functions) | ✅ Full | ✅ | ✅ | ✅ |
| RT.07 (Assessments) | ✅ Full | ✅ | ✅ | ✅ |
| RT.08 (Exit Strategies) | ✅ Full | ✅ | ✅ | ✅ |
| RT.09.01 (Concentration Risk) | ✅ Dynamic | ✅ | ✅ | ✅ |

---

## 5. Validation Engine and Rule Lifecycle

### 5.1 Architecture

The validation engine resides in `src/validation/` and consists of two primary files: `validation.controller.ts` (HTTP endpoints) and `validation.service.ts` (all business logic). The engine operates against the live PostgreSQL database and does not maintain an in-memory rule cache.

### 5.2 Rule Storage

Validation rules are stored in the `validation_rules` table and are seeded via `prisma/seed.ts`. Each rule record contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Rule identifier, stored in `validation_issues.rule_id` |
| `template_name` | VARCHAR(100) | EBA template code (e.g. `RT.02`, `RT.07.01`) |
| `field_name` | VARCHAR(100) | DB column or logical field name |
| `rule_type` | VARCHAR(50) | One of: required / format / fk_exists / range / dropdown / cross-field / conditional |
| `rule_value` | VARCHAR | Regex pattern, FK table spec, or conditional expression |
| `error_message` | VARCHAR | Human-readable message displayed to the user |
| `severity` | VARCHAR(10) | ERROR / WARNING / INFO |
| `dora_article` | VARCHAR(255) | Regulatory citation (e.g. "Art.28(5)") |
| `is_active` | BOOLEAN | Rules set to `false` are skipped entirely |

Rules are loaded at the start of each validation run via `this.prisma.validationRule.findMany({ where: { isActive: true } })`.

**Exact seeded validation rule count: 220 rules (VR_01 – VR_250), covering 9 templates:**

| Template Tag | EBA VR Range | Count | Key Fields Covered |
|---|---|---|---|
| RT.01.01 | VR_01 – VR_11 | 11 | LEI (required + format), name, country (required + ISO), entity type (required + dropdown), integration date (required + format), total assets (required + range) |
| RT.01.02 | VR_12 – VR_18 | 7 | LEI, name, country, total assets, currency (required + ISO), deletion date format |
| RT.01.03 | VR_19 – VR_24 | 6 | Branch name, country (required + ISO), FK to financial entity (required + fk_exists), branch code |
| RT.02.01 | VR_25 – VR_33 | 9 | Contract reference, start date (required + format), end date format, contract type, currency, annual cost range, reliance level (required + dropdown) |
| RT.02.02 | VR_34 – VR_51 | 18 | Financial entity (required + fk_exists), provider (required + fk_exists), governing law country (required + ISO), service country (required + ISO), data sensitivity (required + dropdown), termination notice (required + range), ICT service type (required + dropdown), storage location (conditional on data_storage), processing location (required + ISO), end date cross-field |
| RT.05.01 | VR_60 – VR_72 | 13 | Provider code, LEI (required + format), legal name, Latin name, person type (required + dropdown), headquarters country (required + ISO), ultimate parent LEI format, NACE code format, competent authority, parent LEI conditional on intra-group flag |
| RT.05.02 | VR_80 – VR_84 | 5 | Contract FK (required), provider FK (required), service type dropdown, supply rank (required + range ≥ 1) |
| RT.06.01 | VR_90 – VR_101 | 12 | Function identifier, function name, criticality level (required + dropdown), last assessment date (required + format), RTO (required + range), RPO (required + range), impact of discontinuation, licensed activity |
| RT.07.01 | VR_105 – VR_116 | 12 | Contract FK (required + fk_exists), provider required, substitutability required, substitution reason (conditional on is_substitutable=false), last audit date (required + format), exit plan required, reintegration required, discontinuation impact, alternative providers, alternative reference (conditional) |
| RT.08 | VR_120 – VR_125 | 6 | Contract FK (required + fk_exists), exit trigger required, exit strategy required, fallback provider (required WARNING + fk_exists) |
| RT.05 (ict_services) | VR_130 – VR_138 | 9 | Service name, provider (required + fk_exists), service type (required + dropdown), criticality level (required + dropdown), data sensitivity (required + dropdown) |

**Coverage vs EBA Draft Validation Rules**: The EBA draft validation rule spreadsheet (`Draft validation rules for DORA reporting of RoI.xlsx`) contains approximately 300+ rules across all RT templates. The 220 seeded rules represent the most critical mandatory field checks (primarily `required`, `fk_exists`, `format`, and `dropdown` types) plus a representative set of `conditional` and `cross-field` rules for business-logic-intensive fields (VR_48, VR_51, VR_72, VR_109, VR_116), along with `date_boundary`, `uniqueness`, and `aggregate` structural checks. Rules covering advanced inter-template cross-checks (e.g. verifying that contract references cited in RT.06 rows exist in RT.02) have not been seeded.

### 5.3 Rule Types and Logic

The engine implements seven rule types. Each is a private method in `ValidationService`:

#### `required`
Executes a parameterised raw SQL query: `SELECT id FROM {table} WHERE tenant_id = $1 AND ({field} IS NULL OR {field}::text = '')`. Each row returned is a failing record. Every failing record generates one `ValidationResult`. Used to enforce Art. 28/30 mandatory fields such as LEI on financial entities, start date on contracts, and provider identification code.

#### `format`
Executes: `SELECT id, {field}::text FROM {table} WHERE tenant_id = $1 AND {field} IS NOT NULL`. The `rule_value` is treated as a JavaScript regex pattern. Each fetched record has its field value tested against the regex; non-matching values generate an error. Used for LEI format validation (20-character alphanumeric with check digits), date format, and NACE code patterns.

#### `fk_exists`
Checks referential integrity that PostgreSQL FK constraints do not cover (e.g. soft-references). Queries the referencing table for records where a FK column is non-null but the referenced record does not exist in the target table. Used to detect orphaned contract providers and missing entity references.

#### `range`
Parses `rule_value` as `min:max`. Queries numeric fields and flags records where the value is outside the allowed range. Used for RTO/RPO plausibility checks.

#### `dropdown`
Reads `rule_value` as a reference table name (one of `ALLOWED_REF_TABLES`). Queries the domain table and checks that the FK column value exists in the reference table. Used for entity type, criticality level, reliance level, and ICT service type validation.

#### `cross-field`
Handles logical dependencies between two columns on the same record. `rule_value` encodes the condition as `field1 OPERATOR field2` (e.g. `end_date > start_date`). Used to enforce that contract end dates are after start dates.

#### `conditional`
The most complex type. `rule_value` encodes a JSON expression: `{ "when": { "field": "is_substitutable", "equals": "false" }, "require": "substitution_reason" }`. The engine fetches all records where the trigger condition is true, then checks whether the required field is populated. Used to enforce EBA Validation Rule VR_109: `substitution_reason` is required when `is_substitutable = false` on `ict_service_assessments`.

### 5.4 Issue Lifecycle State Machine

The `ValidationIssue` table tracks the status of each identified problem through the following states:

```
OPEN
  └──[Analyst flags with comment]──→ FLAGGED
        └──[Editor submits fix note]──→ WAITING_APPROVAL
              ├──[Analyst approves]──→ RESOLVED  (permanent, excluded from future runs)
              └──[Analyst rejects]──→ FLAGGED    (Editor must resubmit)

[Rule no longer fires on re-run]──→ FIXED       (auto-closed by engine)
```

**Key design decisions:**
- `RESOLVED` issues are permanently excluded from the `existingIssues` fetch at the start of each new run, preventing re-surfacing.
- `WAITING_APPROVAL` issues that no longer trigger the rule (because the Editor corrected the data) are still preserved in `finalResults` by loading them from the `validation_issues` DB table, not from the stale JSON in `validation_runs.results`. This prevents the system from incorrectly auto-closing issues that are still under Analyst review.
- The engine updates both the JSONB `results` in `validation_runs` AND the relational `validation_issues` table on every state transition.

### 5.5 DORA Compliance Score

Computed at the end of every run:

```
totalFieldsChecked  = max(count of all ValidationResult entries, 1)
activeIssueCount    = count of results where status ∉ {FIXED, RESOLVED}
totalFieldsPassing  = max(totalFieldsChecked – activeIssueCount, 0)
doraScore           = round((totalFieldsPassing / totalFieldsChecked) × 100)
```

The score is stored on `validation_runs.dora_score` and displayed on the Analyst dashboard.

### 5.6 Validation API Endpoints

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/validation/rules` | JWT | Retrieve all active rules |
| POST | `/validation/run` | ANALYST | Execute a new validation run for the tenant |
| GET | `/validation/runs` | JWT | List all runs (summary, no results) |
| GET | `/validation/runs/:id` | JWT | Retrieve full results of a specific run |
| POST | `/validation/runs/:runId/flag` | ANALYST | Flag an issue (OPEN→FLAGGED) + notify Editor |
| PATCH | `/validation/runs/:runId/resolve` | EDITOR | Submit fix (FLAGGED→WAITING_APPROVAL) + notify Analyst |
| PATCH | `/validation/runs/:runId/approve` | ANALYST | Approve fix (WAITING_APPROVAL→RESOLVED) + notify Editor |
| PATCH | `/validation/runs/:runId/reject` | ANALYST | Reject fix (WAITING_APPROVAL→FLAGGED) + notify Editor |

### 5.7 Integration with RoI Export

The `RoiExportService.preflight()` method reads the most recent `ValidationRun` for the tenant and counts issues where `severity = 'ERROR'` and `status NOT IN ('FIXED', 'RESOLVED', 'WAITING_APPROVAL')`. If any such issues exist, the export endpoint throws a `BadRequestException` with the error count and run ID. This ensures that unresolved compliance errors cannot bypass the export gate.

---

## 6. RoI Export: Excel and XBRL OIM-CSV

### 6.1 Architecture

The `RoiExportModule` contains `RoiExportController` and `RoiExportService`. The service uses **ExcelJS 4.4.0** for Excel workbook generation and the **archiver 7.0.1** library for ZIP packaging. All DB queries are performed by the service directly via `PrismaService`.

### 6.2 Supported Templates (Declared in Code)

```typescript
export const SUPPORTED_TEMPLATES = [
  'RT.01.01', 'RT.01.02', 'RT.01.03',
  'RT.02.01', 'RT.02.02',
  'RT.03.01',
  'RT.04.01',
  'RT.05.01', 'RT.05.02',
  'RT.06.01', 'RT.07.01',
  'RT.08.01', 'RT.09.01',
] as const;
```

Thirteen sub-templates are supported (RT.09.01 added 19 April 2026). Each template is defined as a `TemplateDef` object containing an ordered array of `ColumnDef` records mapping `{ code, name, extract }` where `code` is the EBA column reference (e.g. `RT.02.02.0120`), `name` is the human-readable column label, and `extract` is a function that maps a database row to the export value.

### 6.3 Excel Export

- **Endpoint**: `GET /api/v1/roi/export?template=RT.02.02` (single template) or `GET /api/v1/roi/export` (full workbook)
- **Format**: `.xlsx` Excel workbook generated in memory by ExcelJS
- **Sheet naming**: Each worksheet is named by the template code (e.g. `RT.02.02`)
- **Header rows**: Two rows — row 1 contains EBA column codes (e.g. `RT.02.02.0120`) in bold blue; row 2 contains human-readable column names in italic grey. Data begins on row 3.
- **Column widths**: Set to `max(column_name.length + 2, 18)` characters
- **File naming**: `Content-Disposition: attachment; filename="dora_roi_{template}_{date}.xlsx"` (set by controller)

The `generateWorkbook()` method iterates through `SUPPORTED_TEMPLATES` and calls `addSheet()` for each. `generateSingleTemplate()` builds a workbook with only one sheet.

### 6.4 XBRL OIM-CSV Export

- **Endpoint**: `GET /api/v1/roi/export/xbrl`
- **Format**: ZIP archive (`.zip`) containing:
  - `metadata.json`: schema reference URL, reporting period (current date), entity name (from `tenants`), entity LEI, submission date, and a list of all templates with their CSV file names
  - One CSV file per template, named `RT_01_01.csv`, `RT_02_02.csv`, etc. (dots replaced with underscores)
- **CSV structure**: Two header rows (EBA codes, then human-readable names) followed by data rows. Values containing commas, quotes, or newlines are RFC 4180-escaped.
- **EBA OIM alignment**: The file naming convention (`RT_XX_XX.csv`) and the two-row header structure (codes + labels) follow the EBA OIM-CSV reporting format as described in the EBA XBRL taxonomy documentation. The `schemaRef` in `metadata.json` points to `https://www.eba.europa.eu/xbrl/crr/dict/cor`.

### 6.5 Pre-flight Gate

Before generating either format, `RoiExportController` calls `RoiExportService.preflight()`. This method:
1. Retrieves the most recent `ValidationRun` for the tenant.
2. Throws `BadRequestException` (HTTP 400) if no run exists.
3. Counts ERROR-severity issues that are not `FIXED`, `RESOLVED`, or `WAITING_APPROVAL`.
4. Throws HTTP 400 with the error count if any blocking errors exist.
5. Returns the run ID and warning count if the gate is passed.

The frontend `RoiExport` page calls the preflight endpoint before presenting the export buttons, showing a traffic-light indicator (green / amber / red) based on the result.

---

## 7. Security Architecture

### 7.1 Authentication

Authentication is implemented using `@nestjs/passport` with the `passport-jwt` strategy. The system uses a **dual-token architecture** with short-lived access tokens and long-lived rotating refresh tokens:

**Login flow:**
1. User submits email and password to `POST /api/v1/auth/login`.
2. `AuthService.validateUser()` retrieves the user record by email, then calls `bcrypt.compare(password, passwordHash)` with 10 rounds.
3. On success, `AuthService.login()` issues two tokens:
   - **Access token**: JWT signed with `{ id, email, tenantId, role }`, 15-minute expiry.
   - **Refresh token**: 64-byte cryptographically random hex string, stored as a bcrypt hash in `users.refresh_token_hash` with a 7-day expiry timestamp in `users.refresh_token_expires`.
4. Both tokens are returned in the response body. Both are also set as `httpOnly` cookies (access token cookie: 15-min; refresh token cookie: scoped to `/api/v1/auth`, 7-day).
5. The frontend SPA stores `access_token`, `refresh_token`, and `userId` in `localStorage`. *(Note: Storage of tokens in `localStorage` is explicitly acknowledged as a security gap in Chapter 5, as it carries an inherent Cross-Site Scripting (XSS) risk compared to an exclusive HttpOnly cookie approach).*

**Access token validation:**
- `JwtStrategy.validate()` decodes the access token from `Authorization: Bearer` header or the `access_token` cookie, strikes out deactivated users, and populates `request.user`.

**Token refresh flow (automatic):**
1. Axios response interceptor detects a `401 Unauthorized` response from any non-auth endpoint.
2. Calls `POST /api/v1/auth/refresh` with `{ userId, refresh_token }` in the body (refresh token cookie is also sent automatically).
3. Backend validates the raw token against the stored bcrypt hash and checks expiry.
4. On success: rotates both tokens (old refresh token hash is immediately overwritten in DB), returns new access + refresh tokens.
5. Axios interceptor updates `localStorage` and retries the original failed request transparently.
6. If refresh also fails: all credentials cleared, user redirected to `/login`.
7. Concurrent 401 responses during a single refresh are queued and resolved once the new access token arrives.

**Logout:**
- `POST /api/v1/auth/logout` (JWT-guarded) calls `AuthService.logout(userId)`, which sets `refresh_token_hash = null` and `refresh_token_expires = null` in the DB — permanently invalidating all active sessions for the user.

**Password reset security:**
- `resetPassword()` additionally clears `refresh_token_hash` and `refresh_token_expires`, invalidating all active sessions when a password is changed.

Password reset uses a separate 1-hour single-use token stored in `users.reset_token` / `users.reset_token_expires`.

### 7.2 Authorisation (RBAC)

Role-based access control is enforced at the controller level via two custom NestJS decorators:

- `@Roles(...roleNames)`: Sets metadata specifying the permitted roles for a route.
- `RolesGuard`: Reads the metadata and compares `request.user.role` to the permitted roles. Throws `ForbiddenException` if the role does not match.

As of the current implementation, the roles used in guards are:
- **ADMIN**: Tenant management, user management, audit log, RoI export, concentration risk
- **ANALYST**: Validation run, flag/approve/reject issues, read all modules, write to business functions, supply chain, ICT supply chain
- **EDITOR**: Write to ICT Providers, ICT Services, Contractual Arrangements, Exit Strategies; submit validation fixes

The frontend enforces role-based UI by filtering the sidebar navigation array based on `user.role` and wrapping sensitive UI elements in `<RoleGuard allowed={[...]} />` components.

### 7.3 Tenant Isolation

All domain service methods receive `tenantId` from `request.user.tenantId` (JWT claim). Prisma queries are constructed as:

```typescript
this.prisma.contractualArrangement.findMany({ where: { tenantId } });
```

This is enforced by convention in each service method. There is no middleware or Prisma middleware layer that automatically injects the tenant filter — each developer must include the `tenantId` clause. As such, the isolation is **application-layer only** and is not backed by PostgreSQL Row-Level Security policies.

### 7.4 Other Controls

| Control | Implementation |
|---------|---------------|
| Security headers | `helmet()` applied globally in `main.ts` — sets X-Frame-Options, X-Content-Type-Options, HSTS, CSP defaults |
| CORS | `app.enableCors({ origin: 'http://localhost:8000', credentials: true })` in `main.ts` |
| Rate limiting | `ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])` — 10 requests per 60 seconds globally |
| Input validation | `class-validator` DTOs with `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` |
| SQL injection | Parameterised Prisma queries; `$queryRawUnsafe` calls validate table names against a hardcoded whitelist before interpolation |
| Refresh token theft detection | If a client presents an invalid refresh token for a valid userId, the stored hash is immediately cleared, terminating all active sessions |
| Audit log sanitisation | `AuditInterceptor.sanitize()` removes `passwordHash`, `resetToken`, `resetTokenExpires`, `refreshTokenHash`, `refreshTokenExpires` from stored `new_values` |

### 7.5 Audit Logging

The `AuditInterceptor` is registered as a global `APP_INTERCEPTOR` in `AppModule`. It fires on every HTTP request where:
- Method is POST, PATCH, PUT, or DELETE
- `request.user` is set (i.e. the request is authenticated)
- The derived `tableName` is in the `OLD_VALUES_TABLES` whitelist

For PATCH/DELETE, the interceptor pre-fetches the current database record (using `$queryRawUnsafe` with parameterised UUID validation) to capture `old_values`. After the handler succeeds, it writes an `AuditLog` entry with:
- `tenant_id`, `user_id` from JWT
- `action_type` (CREATE/UPDATE/DELETE)
- `table_name` (derived from route path segment, kebab→snake_case)
- `record_id` (from response body `.id` or route param)
- `old_values` (pre-mutation snapshot, JSONB)
- `new_values` (sanitised response body, JSONB)

Additionally, the `ValidationService` calls `this.auditLog.write()` directly for issue lifecycle state transitions (`ISSUE_FLAGGED`, `ISSUE_MARK_FIXED`, `ISSUE_APPROVED`, `ISSUE_REJECTED`), providing a complete audit trail of the compliance workflow.

The Admin Panel frontend reads the audit log via `GET /api/v1/audit-logs` and renders entries with human-readable descriptions (e.g. "User updated Contract: changed Contract Type, Start Date") using a `TABLE_LABELS` mapping and a dynamic `entryLabel()` function in `AdminPanel.tsx`.

---

## 8. Frontend Structure and UX

### 8.1 Frontend Stack

| Component | Library | Version |
|-----------|---------|---------|
| Framework | React | 19.2.4 |
| Build tool | Vite | 8.0.0 |
| Language | TypeScript | 5.9.3 |
| Styling | TailwindCSS | 3.4.19 |
| Component library | Shadcn UI (Radix UI primitives) | shadcn 4.0.8 |
| Router | react-router-dom | 7.13.1 |
| Server state | @tanstack/react-query | 5.90.21 |
| Auth/client state | Zustand | 5.0.12 |
| HTTP client | Axios | 1.13.6 |
| Forms | react-hook-form + Zod | 7.71.2 / 4.3.6 |
| Icons | lucide-react | 0.577.0 |
| i18n | i18next + react-i18next | 25.10.3 / 16.6.0 |

### 8.2 State Management

**Zustand (`authStore`)**: Holds the authenticated user object (`{ id, email, fullName, role, tenantId }`), the logout function, and a `setUser()` function. Populated after a successful login and cleared on logout. Persisted in `sessionStorage` to survive page refresh.

**TanStack Query**: Used for all server-state synchronisation. Every data-fetching hook (e.g. `useQuery({ queryKey: ['contractual-arrangements'], queryFn: contractualArrangementsApi.getAll })`) is backed by a TanStack Query client. After any mutation, the relevant query keys are invalidated via `queryClient.invalidateQueries()` to trigger a background refetch and keep the UI in sync without manual reload.

### 8.3 Main Pages and Routes

#### `/login`, `/forgot-password`, `/reset-password`
Standard authentication flows. Login posts credentials and stores the JWT. Forgot-password sends a reset email. Reset-password validates the token URL parameter and sets a new password.

#### `/` — Dashboard
Role-adaptive dashboard. Three variants:

- **AdminDashboard**: Tenant and user counts, system health indicators, shortcuts to admin functions.
- **AnalystDashboard**: DORA compliance score (from latest `ValidationRun.doraScore`), open/flagged/waiting-approval issue counts with drill-down links, recent validation run history, ICT concentration risk summary.
- **EditorDashboard**: Two panels showing FLAGGED (action required) and WAITING_APPROVAL (submitted, awaiting Analyst review) validation issues from the latest run, with "Mark as Fixed" flow.

#### `/entities` — Financial Entities (RT.01)
Data grid with inline search. CRUD form for `FinancialEntity` with all RT.01 fields (LEI, name, country, entity type, total assets, currency, parent entity). Branch sub-management. Full CRUD restricted to ADMIN.

#### `/providers` — ICT Providers (RT.05.01)
Data grid with search. Full CRUD form covering all EBA RT.05.01 fields including `lei`, `nace_code`, `ultimate_parent_lei`, `intra_group_flag`. Provider hierarchy (parent/child). EDITOR and ADMIN write access.

#### `/contracts` — Contractual Arrangements (RT.02)
Master-detail view. Contract list with search. Create/edit form covering all RT.02.01 and RT.02.02 fields. **Manage Linked Relationships** dialog with three tabs:
- **Business Functions**: Link/unlink `function_ict_dependencies`. Modern card-based UI with DORA context banner. Inline right-side confirmation panel for unlinks.
- **Linked Entities**: Manage `contract_entities` (Art. 29 group coverage, RT.03.01).
- **Subcontractors**: Manage `contract_providers` with display of hire-chain ("hired by" relationship).

#### `/functions` — Business Functions (RT.06)
Data grid. Full CRUD form for `business_functions`. **ICT Dependencies dialog**: Modern split-pane dialog showing linked ICT contracts, filtered drop-down for unlinking (excluding already-linked contracts), Add Link button, inline right-side confirmation panel for removes. ANALYST write access.

#### `/assessments` — ICT Service Assessments (RT.07)
Data grid. Full CRUD form for `ict_service_assessments`. All EBA RT.07.01 assessment fields are present: substitutability, substitution reason, audit dates, exit plan, reintegration, alternative providers.

#### `/supply-chain` — ICT Supply Chain (RT.05.02)
Visual hierarchical tree view of the supply chain for all contracts. Full CRUD interface (ANALYST/ADMIN): Create entries with provider, parent chain link (hired-by), service type, and rank. Delete with confirmation. Real-time refresh via TanStack Query invalidation.

#### `/ict-services` — ICT Services
Data grid. Full CRUD for `ict_services`. Links services to providers, service types, criticality and data sensitivity levels.

#### `/exit-strategies` — Exit Strategies (RT.08)
Data grid. Full CRUD form for `exit_strategies`. Links to contract, optional assessment, exit trigger narrative, strategy narrative, fallback provider.

#### `/validation` — Validation Dashboard
Available to ANALYST only (sidebar hidden from EDITOR after April 2026 fix). Displays:
- Run history with DORA score trend
- Current run results grouped by template
- Issue detail with old/new value diff, Analyst comment, field deep-link
- Action buttons: Flag (Analyst), Approve/Reject (Analyst), Mark as Fixed (Editor, via EditorDashboard)

#### `/roi-export` — RoI Export
Available to ADMIN only. Pre-flight status indicator (green/amber/red). Template grid showing all 13 supported templates with checkboxes. Options:
- **Excel**: download single template or full workbook
- **XBRL OIM-CSV**: download full ZIP package
Export blocked with error message if pre-flight check fails.

#### `/admin` — Admin Panel
Tabs:
- **Tenants**: List and manage tenant records
- **Users**: Create, edit, delete users; assign roles
- **Audit Logs**: Human-readable activity log with old→new value diff panel
- **Concentration Risk**: Provider-level chart of contract count and annual cost; threshold indicators

### 8.4 UX Design Choices

- **Dark theme**: Zinc-950 background throughout, indigo/violet accent palette.
- **Code lists as dropdowns**: All EBA code-list fields (entity type, country, currency, service type, etc.) are rendered as `<select>` elements populated from the `ReferenceModule` API, preventing free-text entry errors.
- **Deep-link navigation**: Validation issues carry `frontendRoute?openId=…&fieldKey=…` URLs. When an Editor navigates to the linked page, the form dialog auto-opens to the relevant record and the relevant field is highlighted by `IssueHintBanner`.
- **Animated confirmation panels**: Destructive actions (unlink, delete) use a right-side expansion panel within the same dialog rather than a blocking overlay. The main content dims and becomes non-interactive while the confirmation panel is shown.
- **TanStack Query invalidation**: Every successful mutation immediately triggers background refetch of affected query keys. Users see updated data without needing to refresh.
- **RoleGuard component**: Wraps action buttons (`+ Add Function`, `Remove`, `Edit`, etc.) in a component that renders `null` when `user.role` is not in the `allowed` array. This provides UI-level enforcement parallel to the backend RBAC guards.

---

## 9. Implementation Status, Testing, and Known Limitations

### 9.1 Implementation Status by Area

| Area | Status | Notes |
|------|--------|-------|
| Data model (30 tables) | ✅ Fully implemented | All tables present; all Prisma relations wired |
| Core CRUD APIs | ✅ Fully implemented | All 14 domain modules active in AppModule |
| Validation engine | ✅ Fully implemented | 10 rule types; full 5-state lifecycle; score computation |
| EBA validation rule coverage | ⚠️ Partial | 220 rules seeded (VR_01–VR_250); covers all 10 rule types and mandatory fields for RT.01–RT.09. Full EBA spreadsheet has ~300+ rules; inter-template cross-checks not yet seeded |
| RoI Export — Excel | ✅ Implemented | 13 sub-templates (RT.01.01–RT.09.01); EBA column codes aligned |
| RoI Export — XBRL OIM-CSV | ✅ Implemented | ZIP with metadata.json; EBA OIM-CSV naming convention; 13 templates |
| Bulk CSV Ingestion | ❌ Not implemented | Parsing and importing legacy EBA Excel registers into the app |
| Security — auth, RBAC | ✅ Implemented | JWT (15-min access token), bcrypt 10 rounds, RolesGuard on all controllers |
| Security — refresh tokens | ✅ Implemented | 7-day rotating refresh tokens; bcrypt-hashed in DB; auto-rotated by Axios interceptor; invalidated on logout + password reset |
| Security — tenant isolation | ✅ DB & App-layer | tenant_id on all queries + strict DB-level PostgreSQL RLS |
| Audit logging | ✅ Active | Global AuditInterceptor; issue lifecycle events also logged |
| Frontend (all pages) | ✅ Functional | All 14 pages rendered and connected to live API |

### 9.2 Automated Testing

Nine Jest spec files exist in the backend:

- `src/app.controller.spec.ts` — basic controller smoke test
- `src/financial-entities/financial-entities.controller.spec.ts`
- `src/financial-entities/financial-entities.service.spec.ts`
- `src/ict-providers/ict-providers.controller.spec.ts`
- `src/ict-providers/ict-providers.service.spec.ts`
- `src/contractual-arrangements/contractual-arrangements.controller.spec.ts`
- `src/contractual-arrangements/contractual-arrangements.service.spec.ts`
- `src/reference/reference.controller.spec.ts`
- `src/reference/reference.service.spec.ts`

These files were scaffolded by the NestJS CLI. No frontend tests (`*.test.tsx`) exist. No integration or E2E test suite is configured. The absence of comprehensive automated tests is a known limitation of the prototype phase.

### 9.3 Known Limitations and Technical Debt

| Area | Limitation |
|------|-----------|
| DB-level RLS | ✅ Fully Implemented (PostgreSQL RLS + `TenantIsolationMiddleware`) |
| Test coverage | Only 9 scaffolded backend spec files; no integration or E2E tests |
| E2E test suite | Playwright suite for full user flow (Login → CRUD → Validate → Export) is **future work**. All data is currently entered via the CRUD forms. This is a significant productivity limitation for entities migrating from existing spreadsheet-based registers. |
| EBA VR coverage | 220 of ~300+ EBA draft validation rules are seeded. Advanced inter-template cross-checks (e.g. verifying that function identifiers in RT.06 correspond to contracts in RT.02) are not yet implemented |
| Pagination | No server-side pagination on list endpoints; large datasets will cause performance degradation |
| `validation_rules.executionOrder` | Not present in schema; rules execute in `templateName ASC` order (Prisma default sort) |
| `AuditLog` user relation | The `user_id` FK on `audit_logs` does not have a typed Prisma `@relation` decorator, making user JOIN queries non-type-safe via Prisma |
| No dedicated concentration risk model | No `concentration_risk` table; risk is computed dynamically from `contractual_arrangements` aggregation |
| Prisma db push | Schema evolution managed via `db push` for development; no formal migration history files exist |

---

## 10. Areas of Uncertainty and Open Academic Questions

### Inferred or Uncertain Details

1. **EBA validation rule coverage**: The `prisma/seed.ts` seeds exactly **220 validation rules** covering EBA VR codes VR_01 through VR_250. These cover mandatory field presence, format checks, FK integrity, code-list conformance, key conditional rules, and logical structural bounds. The EBA draft validation rule spreadsheet contains approximately 300+ rules in total. The gap primarily consists of advanced inter-template cross-checks and some advanced concentration risk rules.

2. **IctServices module vs EBA RT mapping**: The `ict_services` table is an **internal named-service asset register** — it records specific service products offered by ICT providers (e.g. "AWS S3 Storage"). It does **not** directly correspond to any single EBA RT column structure. The correct mapping is: `ict_providers` → EBA RT.05.01 (ICT third-party service providers). The export service already correctly fetches from `ict_providers` for RT.05.01 via `fetchRT0501()`. The `ict_services` table supports exit strategy traceability (via `exit_strategy_services` junction) and internal asset classification; it functions analogously to a Configuration Management Database (CMDB) entry.

3. **RT.08 export**: Now implemented. RT.08.01 was wired into `roi-export.service.ts` on 17 April 2026. The export includes 11 EBA column codes covering contract reference, entity LEI, provider identification code, service type, exit trigger conditions, exit strategy narrative, fallback provider code, assessment linkage, and creation date.

4. **`tenants.competentAuthority` field**: Now implemented. The `competent_authority` column (VARCHAR 100, nullable) was added to the `tenants` table on 18 April 2026 and mapped in Prisma as `competentAuthority`. The RT.01.01.0050 export column extractor (`r._tenant?.competentAuthority`) now resolves correctly. The field can be populated via the Tenant management form in the Admin Panel.

5. **`categorySummary` JSON in `validation_runs`**: Now populated. The validation engine computes a `categorySummary` object at the end of every run, grouping active issues by error class and persisting it to the `category_summary` JSONB column:
   - `missingData` — count of `required` rule failures (mandatory fields absent)
   - `formatErrors` — count of `format` rule failures (regex / date format violations)
   - `logicalErrors` — count of `conditional`, `cross-field`, and `range` violations
   - `regulatoryGaps` — count of `fk_exists` and `dropdown` failures (orphaned references or invalid code-list values)

### Critical Gaps for Academic Chapter Finalisation

1. **Formal test coverage metrics**: If the dissertation claims any level of validation testing, the `.spec.ts` files should be run with Jest coverage to produce a concrete percentage.
2. **EBA rule-count alignment**: A table mapping each of the ~300 EBA validation rules to the `validation_rules.id` seed entries, confirming which rules are implemented and which are missing, would strengthen the Chapter 5 implementation assessment.
3. **Deployment environment**: The platform is confirmed as Docker-compose local development. A statement on intended production deployment (cloud provider, container orchestration, managed DB) should be clarified if Chapter 4 is to address scalability or production architecture.
4. **Performance characteristics**: No load testing has been conducted. If Chapter 5 discusses scalability, this limitation must be explicitly acknowledged.
5. **XBRL taxonomy alignment**: The XBRL OIM-CSV structure follows a simplified two-row header convention. Formal alignment against the EBA XBRL taxonomy (DPM data point model) would require a taxonomy-level review that is beyond the scope of this implementation audit.
