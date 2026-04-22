# DORA SaaS — Master Task Checklist
**Last Updated: 2026-04-19 (Session Final — Security Hardening + Rule Expansion + Documentation)**

> **DB**: DORA_DB | user: postgres | pw: 1234 | port: 5432 | backend: 3000 | frontend: 8000  
> **Demo users**: `admin@demo.com` / `analyst@demo.com` / `editor@demo.com` — seeded via `prisma/seed.ts`  
> **Run**: `docker-compose up -d` → backend `http://localhost:3000` | frontend `http://localhost:8000`

---

## Phase 0 — Infrastructure & DevOps ✅ COMPLETE

- [x] Configure datasource (DORA_DB, postgres/1234) in `backend/.env`
- [x] Align Prisma schema with full SQL schema (30 tables + FK relations)
- [x] Add multi-tenancy support — `tenant_id` on all 20 domain models
- [x] Install Node.js v22.14.0 locally at `backend/.node`
- [x] Fix Prisma v7 config — URL in `prisma.config.ts`
- [x] Run migration baseline (`0_init`) against DORA_DB
- [x] Generate Prisma Client (`npx prisma generate`)
- [x] Seed all reference tables (countries, currencies, entity types, etc.)
- [x] Seed demo dataset (DORA Demo Tenant, 3 users, providers, contracts, intentional validation errors)
- [x] `docker-compose.yml` — 4 services: postgres, backend, frontend, prisma-studio

---

## Phase 1 — Backend Core APIs ✅ COMPLETE

### 1.1 Reference / Lookup Tables ✅
- [x] `countries` — seeded ISO 3166-1 (40 entries)
- [x] `currencies` — seeded ISO 4217 (16 entries)
- [x] `entity_types` — seeded (16 DORA types)
- [x] `criticality_levels` — seeded (3 levels: Critical / Important / Not Critical)
- [x] `reliance_levels` — seeded (4 levels)
- [x] `data_sensitivity_levels` — seeded (5 levels)
- [x] `ict_service_types` — seeded (14 types)
- [x] `provider_person_types` — seeded (2 types: Legal / Natural person)
- [x] `user_roles` — seeded (ADMIN / ANALYST / EDITOR)

### 1.2 Domain Modules (NestJS) ✅
- [x] **Financial Entities module** — CRUD, parent hierarchy, branches
- [x] **ICT Providers module** — CRUD, parent provider hierarchy, LEI, NACE, intra-group flag
- [x] **Contractual Arrangements module** — full CRUD, all FK relations, data flow fields
- [x] **Business Functions module** — CRUD + RPO/RTO fields + `function_ict_dependencies` junction
- [x] **ICT Services module** — CRUD, linked to provider/service type/criticality
- [x] **ICT Supply Chain module** — CRUD + tree hierarchy endpoint `GET /ict-supply-chain/chain/:contractId`
- [x] **ICT Service Assessments module** — substitutability, exit flags, discontinuation impact
- [x] **Exit Strategies module** — CRUD, linked to contract + fallback provider (DORA Art. 28§8)
- [x] **Reference module** — all lookup endpoints (`/reference/countries`, `/reference/currencies`, etc.)
- [x] **Contract Entities / Contract Providers / Entities Using Services** — junction table APIs
- [x] **Tenants module** — CRUD + onboarding wizard
- [x] **Audit Log module** — `AuditLogService.write()` + immutable interceptor
- [x] **Users module** — CRUD, invite flow, role assignment
- [x] **Concentration Risk endpoint** — `GET /risk/concentration` — providers by % of contracts

### 1.3 Auth & RBAC ✅
- [x] JWT access token (15-min expiry, Bearer + HttpOnly cookie)
- [x] Bcrypt password hashing (10 rounds)
- [x] Role guards applied to all controllers (ADMIN / ANALYST / EDITOR)
- [x] Tenant isolation enforced per-query in all service methods
- [x] Password reset flow (email token via nodemailer)
- [x] JWT refresh token rotation — 64-byte cryptographic random, bcrypt-hashed, cleared on logout/reset ✅ (18 Apr 2026)
- [x] Tenant isolation middleware — DB-level PostgreSQL RLS ✅ (18 Apr 2026)

---

## Phase 1.5 — Data Model Hardening ✅ COMPLETE (2026-03-27)

- [x] Rename `model ict_services` → `model IctService` with `@@map("ict_services")`
- [x] Add `tenant_id` to `IctServiceAssessment`
- [x] Add `severity VARCHAR(10)` to `validation_rules`
- [x] Add `is_active BOOLEAN DEFAULT TRUE` to `validation_rules`
- [x] Create `validation_runs` table and `ValidationRun` model
- [x] Add missing DORA fields to `IctProvider` (lei, nace_code, ultimate_parent_lei, intra_group_flag, competent_authority)
- [x] Wire `EntitiesUsingService` Prisma relations
- [x] Resolve dual exit strategy tracking (optional `assessmentId` FK on `ExitStrategy`)
- [x] Delete dead stub directories (`src/contracts/`, `src/entities/`, `src/providers/`)
- [x] Implement `AuditLogService.write()` with full field set

---

## Phase 2 — Validation Engine ✅ COMPLETE (220 Rules)

- [x] Parse `Draft validation rules for DORA reporting of RoI.xlsx` → EBA rules seeded
- [x] `GET /validation/rules` — list all active rules from DB
- [x] `POST /validation/run` — execute all 10 rule types; persist to `validation_runs` + `validation_issues`
- [x] `GET /validation/runs` — list run history
- [x] `GET /validation/runs/:id` — get specific run with full results
- [x] **10 rule types implemented**: `required`, `fk_exists`, `format`, `range`, `dropdown`, `cross-field`, `conditional`, `date_boundary`, `uniqueness`, `aggregate`
- [x] Severity levels: ERROR / WARNING — read from DB `severity` column
- [x] Pre-flight gate — blocks RoI export if unresolved ERROR issues exist
- [x] Validation Dashboard frontend page — run validation, view results by template, run history
- [x] Multi-role validation workflow — OPEN → FLAGGED → WAITING_APPROVAL → RESOLVED / FIXED
- [x] **220 EBA rules seeded** (VR_01–VR_250) covering RT.01–RT.09 across all 9 templates ✅ (19 Apr 2026)

---

## Phase 3 — Register of Information (RoI) Export ✅ COMPLETE (13 Templates)

- [x] Parse `RegisterInformationTemplatesIllustration.xlsx` → EBA column definitions for RT.01–RT.09
- [x] Implement `RoiExportService` with `exceljs` — DB→EBA column mapping per template
- [x] RT.01.01, RT.01.02, RT.01.03 — Financial entities and branches
- [x] RT.02.01, RT.02.02 — Contractual arrangements (general + specific)
- [x] RT.03.01 — Group-level contract coverage
- [x] RT.04.01 — Entities and branches using services
- [x] RT.05.01 — ICT third-party service providers
- [x] RT.05.02 — ICT supply chain tiers
- [x] RT.06.01 — Critical/important business functions
- [x] RT.07.01 — ICT service assessments
- [x] RT.08.01 — Exit strategies ✅ (17 Apr 2026)
- [x] `GET /roi/export?template=RT.01.01` — single or full workbook Excel download
- [x] `GET /roi/templates` — list available templates
- [x] `GET /roi/preflight` — pre-flight validation gate
- [x] `GET /roi/export/xbrl` — XBRL OIM-CSV ZIP package (CBI submission format)
- [x] XBRL conformance fixes: correct DORA schemaRef URI, register reference date, type-aware `formatCsvValue()`, entityName/entityLei from FinancialEntity ✅ (17–19 Apr 2026)
- [x] RoI Export frontend page — pre-flight check, template grid, Excel + XBRL download buttons

---

## Phase 4 — Frontend Pages ✅ COMPLETE

### 4.1 Auth & Shell
- [x] Login page with branding
- [x] Forgot Password / Reset Password page
- [x] Sidebar navigation (all module routes)
- [x] Role-based route guards

### 4.2 Core DORA Data Entry
- [x] Dashboard — live API stats, KPI cards, chart widgets
- [x] Financial Entities — list + structured form (RT.01 aligned)
- [x] ICT Providers — list + structured form (RT.05.01 aligned: LEI, NACE, parent LEI, intra-group)
- [x] Contractual Arrangements — list + detail + form (RT.02 aligned: all 25 fields)
- [x] Business Functions — list + form + ICT dependency modal (RT.06 aligned)
- [x] ICT Service Assessments — decision-based form (RT.07 aligned: substitutability, exit, alternatives)
- [x] ICT Supply Chain — hierarchical tree view + CRUD
- [x] ICT Services — full CRUD (internal register)
- [x] Exit Strategies — full CRUD, DORA Art. 28§8 warnings

### 4.3 Validation & Compliance
- [x] Validation Dashboard — trigger run, grouped results by template, score cards
- [x] Validation run history — click to review any prior run
- [x] Pre-flight gate banner
- [x] Issue drill-down in entity forms (live validation issues per record)
- [x] DORA Compliance Score widget
- [x] 5-state issue lifecycle UI (OPEN → FLAGGED → WAITING_APPROVAL → RESOLVED / FIXED)
- [x] Deep-link notifications — click notification → go directly to affected record

### 4.4 Reporting & Export
- [x] RoI Export page — pre-flight check, template grid, Excel + XBRL downloads
- [x] Pre-flight status indicator (export disabled if errors > 0)

### 4.5 Admin
- [x] Admin Panel — tenant details, user list, role assignment
- [x] User invitation form
- [x] Tenant onboarding wizard
- [x] Audit Log viewer (paginated, filterable by user/date/table)
- [x] Concentration Risk page (provider concentration chart)

---

## Phase 5 — Multi-Tenancy & Admin ✅ COMPLETE

- [x] Tenant model in DB with `tenant_id` isolation in all service queries
- [x] Tenant CRUD API (`/tenants`)
- [x] User management API (CRUD, invite, role assignment)
- [x] Audit Log service + global interceptor
- [x] Audit Log viewer frontend
- [x] Concentration risk engine (`GET /risk/concentration`)
- [x] Multi-role notification system with deep-links
- [x] Threaded comment system (polymorphic on any entity)

---

## Phase 5.5 — Security Hardening ✅ COMPLETE (2026-04-18)

- [x] **Refresh token rotation** — 64-byte cryptographic random, bcrypt-hashed server-side; rotated on every use; cleared on logout and password reset
- [x] **PostgreSQL RLS** — `prisma/rls_policies.sql` enables RLS + creates tenant isolation policies on all **14 domain tables** and **6 junction tables**
- [x] **TenantIsolationMiddleware** — registered globally in `AppModule`; sets `app.current_tenant_id` session variable at the start of every request via `prisma.$executeRawUnsafe`
- [x] **RLS verified** — `test_rls.js` confirms cross-tenant queries return zero rows
- [x] **XBRL OIM-CSV conformance** — schemaRef URI fixed, reportingPeriod = register reference date, `formatCsvValue()` for type-aware formatting
- [x] **XBRL entity identity** — `entityName` + `entityLei` pulled from primary FinancialEntity (not Tenant container)
- [x] **220 EBA validation rules** — VR_01–VR_250 seeded covering all 9 active templates

---

## Phase 6 — Testing ⚠️ 5% Complete

- [x] Unit test stubs exist (`*.spec.ts` files scaffolded in `validation/`, `roi-export/`, `auth/`)
- [ ] Unit tests: `ValidationService` rule execution (Jest) — ≥ 80% coverage
- [ ] Unit tests: `RoiExportService` template extraction (Jest) — with reference dataset
- [ ] Integration tests: all API endpoints (Supertest)
- [ ] E2E tests: Login → data entry → run validation → export (Playwright)

---

## Phase 7 — Documentation ✅ COMPLETE (2026-04-19)

- [x] `project_snapshot.md` — v5.0, 19 April 2026
- [x] `master_plan.md` — v4.0, 19 April 2026
- [x] `task.md` — this file, v5.0
- [x] `dora_saas_technical_description.md` — v5.0, 19 April 2026
- [x] `technical_qa.md` — v2.0 (19 April 2026 — Q3 RLS, Q7 XBRL, Q8 maturity updated)
- [x] `app_vs_dissertation.md` — v5.0 (sections 1.5, 2.5, B.4 updated; RLS ✅; 220 rules)
- [x] `validation_rules.md` — full rewrite, 220 rules, per-template breakdown
- [x] `data_dictionary.md` — full rewrite, all 30+ tables with DORA column codes
- [x] `dora_article_mapping.md` — full rewrite (Art. 4, 11, 28(1)–(8), 29, 30, 25, 19)
- [x] `Dora SaaS and CBI.md` — full rewrite (v5.0 — data flow, security, templates, limitations)
- [x] `structuresql` — updated to reflect all current live tables and RLS field additions

---

## Future Work (Deferred)

| Feature | Priority | Description |
|---------|----------|-------------|
| E2E / Integration tests (Phase 6) | High | Playwright Login → Validate → Export flow |
| Bulk CSV ingestion | High | Parse/import existing EBA Excel template |
| Formal Prisma migrations | Medium | Replace `db push` with `prisma migrate` |
| AI-assisted compliance | Medium | LLM field suggestion / ICT classification |
| Production deployment guide | High | CORS env, JWT secret, SMTP, TLS, `/health` |
| MFA | Medium | TOTP for Admin/Analyst |
| Real-time collaboration | Low | WebSocket live updates during remediation |

---

## Completed Work Log

| Date | Session | What Was Done |
|------|---------|--------------|
| 2026-03-17 | 1 | Monorepo init, Prisma setup, JWT auth, RBAC scaffold, Shadcn UI |
| 2026-03-22 | 2 | DB 22→30 table alignment, Financial Entities, ICT Providers, Contractual Arrangements |
| 2026-03-26 | 3 | Business Functions + ICT Dependencies, ICT Service Assessments, i18n |
| 2026-03-27 | 4 | Demo seed with bcrypt, project memory consolidation |
| 2026-03-27 | 5 | Architecture cleanup (removed dead stubs from AppModule) |
| 2026-03-27 | 6 | ICT Services + ICT Supply Chain + Exit Strategies modules |
| 2026-03-27 | 7 | Validation Engine skeleton (POST /validation/run, required + fk_exists) |
| 2026-03-27 | 8 | Full system audit — gaps, inconsistencies, DORA coverage 38% |
| 2026-03-27 | 9 | Phase 1.5 COMPLETE — schema hardening, db push, all code updated |
| 2026-03-27 | 10 | Frontend DORA Alignment (ICT Providers 5 fields, Financial Entities, Assessments redesign) |
| 2026-03-27 | 11 | Phase 2 Validation Engine — 7 rule types, 61 initial EBA rules, Validation Dashboard |
| 2026-03-27 | 12 | Phase 2.5 — Exit Strategies page, ICT Services page |
| 2026-03-31 | 13 | Phase 3 RoI Export COMPLETE — RT.03/RT.04 added, XBRL OIM-CSV export |
| 2026-03-31 | 14 | Phase 5 Admin/Audit COMPLETE — Tenants, Users, Audit Interceptor, Concentration Risk |
| 2026-04-02–09 | 15–17 | Validation lifecycle fix, LEI bug fix, DORA compliance score, role cleanup |
| 2026-04-16 | 18 | Editor/Analyst Workflow COMPLETE — state machine, notifications, deep-linking, comments |
| 2026-04-17 | 19 | RT.08.01 export wired; XBRL conformance fixes (schemaRef, reportingPeriod, type formatting) |
| 2026-04-18 | 20 | PostgreSQL RLS applied to 20 tables; TenantIsolationMiddleware registered globally |
| 2026-04-19 | 21 | 220 EBA rules seeded (VR_01–VR_250); XBRL entityName/LEI from FinancialEntity; all docs updated |
