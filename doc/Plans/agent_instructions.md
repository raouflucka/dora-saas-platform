# DORA SaaS — Agent Instructions & Session History
**Last Updated: 2026-03-27**

This document serves two purposes:
1. **Coding rules and constraints** — read before writing any code
2. **Session history** — chronological log of all major decisions and implementations

---

## PART A — CODING RULES & CONSTRAINTS

### Fundamental Rules
- **NEVER restart the project** — always continue from current state
- **NEVER regenerate existing modules** — read before touching
- **NEVER overwrite files without reading them first**
- **SQL schema is source of truth** — Prisma schema must match DB (use `prisma db push` to verify)
- **Work incrementally** — one module at a time, verify compile after each
- **TypeScript must compile cleanly** — run `.node/bin/node node_modules/.bin/tsc --noEmit` before finishing

### Architecture Rules
- Multi-tenant: every domain query MUST filter by `tenantId` from `req.user.tenantId`
- Every new controller MUST apply `@UseGuards(JwtAuthGuard, RolesGuard)` at class level
- Every method MUST have `@Roles('ADMIN', ...)` with appropriate role restrictions
- All new Prisma models MUST use PascalCase (`model IctService`, not `model ict_services`)
- All DB table names use `@@map("snake_case")` for PostgreSQL compatibility
- DTOs use `class-validator` decorators (`@IsString`, `@IsUUID`, `@IsOptional`, etc.)
- Services must verify FK ownership before create/update (cross-tenant access prevention)

### File Structure Conventions
```
src/
  [module-name]/
    dto/
      create-[entity].dto.ts
      update-[entity].dto.ts    ← extends PartialType(CreateDto)
    [module].service.ts
    [module].controller.ts
    [module].module.ts
```

### Common Patterns
```typescript
// Service method pattern
async findOne(id: string, tenantId: string) {
  const record = await this.prisma.model.findFirst({
    where: { id, tenantId },  // always both
  });
  if (!record) throw new NotFoundException(...);
  return record;
}

// Controller pattern
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('resource')
export class Controller {
  @Roles('ADMIN', 'ANALYST')
  @Post()
  create(@Request() req, @Body() dto: CreateDto) {
    return this.service.create(req.user.tenantId, dto);
  }
}
```

### What NOT to Do
- Do not add error handling for scenarios that cannot happen
- Do not add docstrings/comments to unchanged code
- Do not create helpers for one-time operations
- Do not use `prisma.$queryRawUnsafe` unless the table name is whitelisted
- Do not hardcode tenant IDs, roles, or country codes
- Do not skip the TypeScript compile check

---

## PART B — SESSION HISTORY

### 2026-03-17 — Session 1: Foundational Setup
**What was done:**
- Initialized monorepo (`/backend` NestJS + `/frontend` React/Vite)
- Configured Prisma v7.5.0 with PostgreSQL (DORA_DB)
- Implemented JWT auth (login, register) with Bcrypt + Passport.js
- Scaffolded RBAC: `JwtAuthGuard`, `RolesGuard`, `@Roles` decorator
- Set up Shadcn UI, TailwindCSS, Zustand, TanStack Query
- Created `DashboardLayout` with sidebar, `ProtectedRoute` wrapper
- Implemented Login page with glassmorphism design

**Key decisions:**
- Shared-schema multi-tenancy (tenant_id on every table) over separate schemas
- JWT access token only (no refresh token yet — deferred)
- `backend/.node` local Node.js install to avoid Docker dependency for dev

---

### 2026-03-22 — Session 2: Core Domain
**What was done:**
- Aligned Prisma schema with 22-table DORA master schema
- Injected `tenant_id` on all domain models
- Implemented full-stack: Financial Entities (+ Branches), ICT Providers, Contractual Arrangements
- Seeded all 9 reference tables (countries, currencies, entity types, etc.)
- Built frontend pages: FinancialEntities, IctProviders, ContractualArrangements
- Implemented i18n (English default, French detection)
- Country/currency fields use DB lookup — no free-text

---

### 2026-03-26 — Session 3: Compliance Modules
**What was done:**
- Implemented Business Functions module (CRUD + RPO/RTO, Art. 28§4)
- Implemented `function_ict_dependencies` — many-to-many link functions ↔ contracts
- Implemented ICT Service Assessments (substitutability, exit flags, Art. 28§5)
- Built frontend pages: BusinessFunctions (with dependency modal), IctServiceAssessments

---

### 2026-03-27 — Session 4: Demo + Memory
**What was done:**
- Debugged bcrypt mismatch in seed script — fixed by integrating bcrypt directly
- Demo login confirmed: `demo@example.com` / `123456`
- Created `agent_instructions.md` (session history) and `project_snapshot.md` (technical snapshot)

---

### 2026-03-27 — Session 5: New Modules + Architecture Cleanup
**What was done:**

**Architecture cleanup:**
- Removed `EntitiesModule`, `ContractsModule`, `ProvidersModule` from AppModule
- All three were empty stubs (empty controllers/services) — no logic, no dependents
- Stub files remain on disk but are not loaded by NestJS

**ICT Services module** (`src/ict-services/`):
- Full CRUD backend: `POST/GET/PATCH/DELETE /api/v1/ict-services`
- Links: `provider_id`, `service_type_id`, `criticality_level_id`, `data_sensitivity_id`
- `prisma db push` confirmed DB in sync (table was already added by prior schema update)

**ICT Supply Chain module** (`src/ict-supply-chain/`):
- Full CRUD + `GET /ict-supply-chain/chain/:contractId` hierarchy endpoint
- Hierarchy model: `supply_rank = 1` = direct provider, `N` = N-th party subcontractor
- Self-reference guard: rejects `providerId === subcontractorProviderId`

**Exit Strategies module** (`src/exit-strategies/`):
- New table `exit_strategies` added to Prisma schema + pushed to DB
- Full CRUD: `exitTrigger`, `exitStrategy`, `fallbackProviderId`
- Links to `contractual_arrangements` (cascade delete) + `ict_providers` (fallback)

**Validation Engine** (`src/validation/`):
- `GET /validation/rules` — loads `validation_rules` from DB
- `POST /validation/run` — executes `required` and `fk_exists` rule types
- Table names are whitelisted before raw queries (security)
- Returns: `{ totalErrors, totalWarnings, results[] }` with `recordId` for drill-down

**ICT Supply Chain frontend** (`frontend/src/pages/IctSupplyChain.tsx`):
- Hierarchical read-only view grouped by `supply_rank`
- Contract selector dropdown
- Sidebar link added: "Supply Chain" with `GitBranch` icon

---

### 2026-03-27 — Session 6: Full System Audit
**What was done:**
- Comprehensive audit of all backend modules, frontend pages, Prisma schema, DORA templates
- Identified critical gaps: AuditLogService empty, ict_services naming issue, missing DORA fields on IctProvider, orphaned Prisma models, dual exit strategy tracking conflict
- Scored readiness: 38% overall
- Defined Phase 1.5 (Data Model Hardening) as new required phase
- Updated all /doc files to reflect current state

**Key findings:**
- `IctServiceAssessment` has no direct `tenant_id` — isolation is join-based only
- `ContractEntity`, `ContractProvider`, `EntitiesUsingService` have no Prisma `@relation` decorators — ORM cannot join them
- `model ict_services` uses snake_case — must be renamed to `model IctService`
- RT.09 (Concentration Risk) is 0% implemented
- RoI export (Phase 3) is 0% implemented
- Validation results are in-memory only — not persisted

---

### 2026-03-27 — Session 7: Phase 1.5 Data Model Hardening
**What was done:**

**Schema changes (all applied via `prisma db push` + `prisma generate`):**
- `ValidationRule`: added `severity VARCHAR(10) DEFAULT 'ERROR'` and `is_active BOOLEAN DEFAULT TRUE`
- `ValidationRun`: new table with `tenant_id`, `executed_at`, `total_errors`, `total_warnings`, `total_info`, `results JSONB`
- `IctProvider`: added `lei`, `nace_code`, `ultimate_parent_lei`, `intra_group_flag`, `competent_authority`
- `IctServiceAssessment`: added `tenant_id` + `@relation` to `Tenant`; added `exitStrategies ExitStrategy[]` backrelation
- `ExitStrategy`: added `assessment_id` FK to `IctServiceAssessment` (optional, resolves dual tracking)
- `model ict_services` renamed to `model IctService` with `@@map("ict_services")`
- `ContractEntity`, `ContractProvider`, `EntitiesUsingService`: all `@relation` decorators wired with cascade delete

**Code changes:**
- `ict-services.service.ts`: updated to `prisma.ictService` with camelCase fields and relation names
- `validation.service.ts`: filters `isActive: true`; reads `severity` from DB; persists `ValidationRun` on each run; `runValidation()` now returns `ValidationRunSummary` with `runId`
- `validation.controller.ts`: `GET /validation/runs` endpoint added; `run` response now returns full `ValidationRunSummary`
- `audit-log.service.ts`: `write()` method implemented — persists to `audit_logs` table
- `audit-log.module.ts`: PrismaModule imported; AuditLogService exported
- `risk-assessment.service.ts`: `create()` sets `tenantId`; `findAll()`/`findOne()` add direct `tenantId` filter
- `ict-providers/dto/create-ict-provider.dto.ts`: added 5 new DORA fields with `@ApiPropertyOptional`
- `exit-strategies/dto/create-exit-strategy.dto.ts`: added optional `assessmentId`
- `exit-strategies.service.ts`: passes `assessmentId` to `prisma.exitStrategy.create()`

**Cleanup:**
- `src/contracts/`, `src/entities/`, `src/providers/` stub directories deleted from disk

**Verification:**
- `prisma db push` → DB in sync
- `prisma generate` → client regenerated
- `tsc --noEmit` → 0 errors

**Key decisions:**
- `nature_of_ict_services` field NOT added to `IctProvider` (not in RT.03 column set — deferred to Phase 3 field mapping)
- `exitPlanExists` boolean retained on `IctServiceAssessment` (quick status flag) + new `assessmentId` FK on `ExitStrategy` for full drill-down
- `ContractEntity`/`ContractProvider`/`EntitiesUsingService` kept (no NestJS modules yet — Phase 2.5)

### 2026-03-27 — Session 8: Frontend DORA Alignment Phase
**What was done:**

**ICT Providers page (RT.03 alignment):**
- Added 5 DORA fields: LEI, NACE code, Ultimate Parent LEI, Intra-Group flag, Competent Authority
- Structured form into 3 sections: Identification, DORA Regulatory Info, Location & Cost
- Fixed RBAC: AUDITOR can no longer create/edit (was wrongly allowed)
- Table now shows LEI and Intra-Group columns
- API interface updated with new fields

**Financial Entities page (RT.01 alignment):**
- Added Entity Type dropdown (from reference table), Parent Entity selector, Total Assets, Deletion Date
- Structured form into 3 sections: Entity Identification, Location & Financials, Register Dates
- Added EBA field reference hints on LEI and Entity Type
- Fixed RBAC: AUDITOR → read-only
- Table shows Total Assets column

**Contractual Arrangements page (RT.02/RT.05):**
- Fixed RBAC: AUDITOR → read-only
- Already well-aligned with template — no field changes needed

**Business Functions page (RT.04):**
- Already correct: proper RBAC (ADMIN/ANALYST), structured sections, all DB fields present
- No changes needed

**ICT Service Assessments page (RT.06 — MAJOR REDESIGN):**
- Replaced flat checkboxes with decision-based logic per DORA Art. 28§5:
  - Substitutability: dropdown (Fully/Partially/Not substitutable) with conditional justification field
  - Exit Strategy: Yes/No decision with DORA warning when missing
  - Alternative Provider: Yes/No decision with provider selector; concentration risk warning when single provider
- Form restructured into 5 logical sections: Service Overview, Substitutability, Exit Strategy, Alternative Providers, Risk Impact
- Added inline DORA compliance warnings (WarningBanner, InfoHint components)
- Table enhanced with Substitutability, Exit Plan, Alt. Provider columns with colored badges
- Maps cleanly back to existing DB fields (isSubstitutable, exitPlanExists, alternativeProvidersExist)

**Supply Chain page (RT.07):**
- Verified aligned: read-only tree view with supply_rank, provider, subcontractor — no changes needed

**RBAC fix summary:** 3 pages had AUDITOR incorrectly allowed to create/edit. Fixed to ADMIN/ANALYST only.

### 2026-03-27 — Session 9: Phase 2 Validation Engine + Phase 2.5 Missing Pages

**Phase 2 — Validation Engine (90% complete):**
- Parsed 126 official EBA ITS rules from `/doc/Draft validation rules for DORA reporting of RoI.xlsx`
- Mapped EBA column codes (c0010, c0020...) to DB field names per template
- Created `prisma/seed-validation-rules.ts` — seeded 61 rules across 9 templates
- Implemented 5 new rule types in `ValidationService`: `format` (regex), `range` (min/max), `dropdown` (ref table lookup), `cross-field` (field comparison), `conditional` (if-then)
- Added `GET /validation/runs/:id` endpoint for fetching run with full results
- Created `/doc/validation_rules.md` — complete mapping documentation

**Phase 2.5 — Missing Frontend Pages:**
- **Exit Strategies page** (`/exit-strategies`): full CRUD, 3-section form (Contract, Exit Conditions, Fallback Provider), DORA Art. 28§8 warnings
- **ICT Services page** (`/ict-services`): full CRUD, 2-section form (Service Identification, Classification & Risk), criticality badges
- **Validation Dashboard** (`/validation`): run validation, score cards, pre-flight gate, results grouped by template, run history
- All 3 pages wired with routes in App.tsx + sidebar links in DashboardLayout.tsx
- API files: `api/exitStrategies.ts`, `api/ictServices.ts`, `api/validation.ts`

**Key decisions:**
- Seeded 61 of 126 EBA rules — remaining 65 are complex cross-template/GLEIF/EUID checks requiring Phase 3 export mapping
- Pre-flight gate blocks export if ANY errors exist (green/red banner on Validation Dashboard)
- Supply Chain CRUD and Dashboard KPIs deferred to parallel work (lower priority than Phase 3)

---

### 2026-03-27 — Session 10: Phase 3 RoI Export

**Backend — RoiExportModule:**
- Installed `exceljs` for Excel generation
- Created `src/roi-export/` module: service, controller, module
- `RoiExportService` maps 9 EBA RT templates to DB queries with exact EBA column codes:
  - RT.01.01 (6 cols), RT.01.02 (11 cols), RT.01.03 (4 cols)
  - RT.02.01 (5 cols), RT.02.02 (18 cols)
  - RT.05.01 (9 cols), RT.05.02 (7 cols)
  - RT.06.01 (10 cols), RT.07.01 (12 cols)
- Each sheet has header row (EBA codes) + name row + data rows
- `GET /roi/export` — full workbook or `?template=RT.01.01` for single sheet
- `GET /roi/preflight` — runs validation, blocks if errors > 0
- `GET /roi/templates` — lists available templates
- Registered `RoiExportModule` in AppModule

**Frontend — RoI Export page:**
- `api/roiExport.ts` — preflight, templates, blob download
- `pages/RoiExport.tsx` — pre-flight check panel, template grid with download buttons, success/error feedback
- Route `/roi-export` + sidebar "RoI Export" with FileSpreadsheet icon

---

### 2026-04-16 — Session 11: Editor-Analyst Collaborative Workflow

**What was done:**
- Implemented state-machine driven `ValidationIssues` linking into UI workflows
- Created `NotificationsModule` with fully working cross-role Pings
- Implemented `CommentsModule` with Threaded Collaboration Panels built natively into dialogs (e.g., Contracts, Entities, Providers, Exit Strategies)
- Deep-linking URL architecture applied dynamically throughout application fetching `openContractId` etc., syncing Editor and Analyst users.
- Role-based constraints accurately mapped to `@Roles` logic ensuring safe Editor CRUD functionality, and Analyst Read-Only / Flag functionality.

---

## PART C — KNOWN ISSUES TO FIX NEXT

All primary application compliance workflows and exports are strictly functional.

1. **Dashboard hardcoded stats** → Replace KPI visualizations with API-driven queries from ValidationRuns.
2. **Missing frontend page**: Settings Page (Currently dummy placeholder).
3. **Automated Testing Suite Deployment** -> Wire integration specs before production launch.

---
*This document must be appended after every session with a dated entry.*
