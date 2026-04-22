# DORA SaaS — Master Plan
**Last Updated: 2026-04-19 | Version: 4.0**

> **Regulatory Context**: DORA (Digital Operational Resilience Act — EU 2022/2554) entered into force on 17 January 2025. Irish financial entities must maintain a Register of Information (RoI) documenting all ICT third-party dependencies, validate data against EBA/EIOPA/ESMA rules, and submit to the CBI (Central Bank of Ireland).
>
> **Connection**: `postgresql://postgres:1234@localhost:5432/DORA_DB` — Backend: port **3000** — Frontend: port **8000**

---

## 1. Product Vision

**DORA SaaS** is a modular multi-tenant RegTech platform that allows Irish SME financial entities to:
1. **Structure** their RoI registers aligned to EBA ITS templates (RT.01–RT.09)
2. **Validate** data automatically against EBA/RTS/2024 rules
3. **Export** auditable reports for CBI submission
4. **Map** the full ICT supply chain (multi-level subcontractors, N-th party risk)
5. **Manage** exit strategies and substitutability assessments (DORA Art. 28§5)

### Differentiator
Unlike enterprise GRC platforms (RSA Archer, ServiceNow), DORA SaaS targets **proportional compliance** (Art. 4 DORA) for SMEs — onboarding < 1 hour, guided interface, real-time validation.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React 18 + Vite, port 8000)           │
│  Login │ Dashboard │ Entities │ Providers │ Contracts │ Functions   │
│  Supply Chain │ Assessments │ Exit Strategies │ Validation │ RoI    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST/JSON (JWT Bearer)
┌──────────────────────────────▼──────────────────────────────────────┐
│                    BACKEND (NestJS + TypeScript, port 3000)          │
│                                                                     │
│  Auth │ Users │ FinancialEntities │ IctProviders │ Contracts        │
│  Functions │ IctServices │ SupplyChain │ RiskAssessment             │
│  ExitStrategies │ Validation │ RoiExport │ AuditLog │ Reference     │
│                                                                     │
│               Prisma ORM v7.5.0 (multi-tenant, type-safe)           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│              PostgreSQL 16 — DORA_DB (31 tables)                    │
│                                                                     │
│  Reference: countries, currencies, entity_types, criticality_levels │
│  Core: financial_entities, ict_providers, contractual_arrangements  │
│  Compliance: business_functions, ict_services, ict_supply_chain     │
│  Risk: ict_service_assessments, exit_strategies                     │
│  System: tenants, users, audit_logs, validation_rules, comments,    │
│          notifications, validation_issues, validation_runs          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Domain Logic Chain (DORA Art. 28)

```
Financial Entity (RT.01)
  └── Branch (Art. 28)
  └── Business Function (RT.04) — criticality, RPO, RTO
        └── Function ↔ Contract dependency (many-to-many)
              └── Contractual Arrangement (RT.02) — the central hub
                    └── ICT Provider (RT.03) — legal entity, hierarchy
                    └── ICT Service (RT.05) — service abstraction layer
                    └── ICT Supply Chain (RT.07) — supply_rank 1..N
                    └── ICT Service Assessment (RT.06) — substitutability
                    └── Exit Strategy (RT.08) — exit trigger + plan
                    └── Concentration Risk (RT.09) — tenant-specific analysis
```

This chain is fully modeled in the database. All relationships are enforced via FK constraints and Prisma relations.

---

## 4. Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Backend | NestJS + TypeScript | Modular DI, decorators, Swagger auto-gen |
| ORM | Prisma v7.5.0 | Type-safe, `db push` for dev |
| Database | PostgreSQL 16 | JSONB audit, UUID native, DORA_DB |
| Auth | JWT (access token) + Bcrypt | Stateless, RBAC-ready |
| Frontend | React 18 + Vite | SPA, fast HMR |
| State | Zustand + TanStack Query | Auth state + server cache |
| Styling | TailwindCSS + Shadcn UI | Radix primitives, dark theme |
| Node.js | v22.14.0 (local at `backend/.node`) | No Docker required for dev |

---

## 5. Delivery Phases

### Phase 0 — Infrastructure ✅ COMPLETE
- Prisma schema (27 tables), migration baseline, seeding, Docker config
- **Deliverable**: DB operational, Prisma Studio shows all tables

### Phase 1 — Backend Core APIs (82% Complete)
- Full CRUD for: Financial Entities, ICT Providers, Contractual Arrangements, Business Functions, ICT Services, ICT Supply Chain, ICT Service Assessments, Exit Strategies
- Auth: JWT login, password reset, RBAC guards
- **Remaining**: Tenants module, Users CRUD, Entities Using Services, Audit Log, Concentration Risk endpoint

### Phase 1.5 — Data Model Hardening ✅ COMPLETE (2026-03-27)
All audit-identified schema fixes applied:
- `model IctService` (renamed from `ict_services`) — `prisma.ictService` in all service code
- `tenant_id` on `IctServiceAssessment` — set on create, filtered on read
- `severity` + `is_active` on `validation_rules` — ValidationService uses both
- `validation_runs` table — results persisted on every `POST /validation/run`
- DORA fields on `IctProvider` — LEI, NACE, parent LEI, intraGroupFlag, competentAuthority
- `ContractEntity`, `ContractProvider`, `EntitiesUsingService` — Prisma `@relation` decorators wired
- `ExitStrategy.assessmentId` — optional FK to `IctServiceAssessment` resolves dual tracking
- `AuditLogService.write()` implemented — PrismaModule imported, service exported
- Dead stubs deleted — `src/contracts/`, `src/entities/`, `src/providers/` removed
- TypeScript compiles cleanly (0 errors)

### Phase 2 — Validation Engine (100% Complete)
- Parsed official EBA ITS rules from `/doc/Draft validation rules for DORA reporting of RoI.xlsx`
- **220 rules seeded** (VR_01–VR_250) across all 9 active templates — all 10 rule types represented
- Multi-role workflow state machine: Analysts flag, Editors fix, Analysts resolve ✅
- `POST /validation/run` executes all rules, persists to `validation_runs` and `validation_issues` ✅
- Live issue propagation inside target record UI forms ✅
- Pre-flight gate: Validation Dashboard blocks export if errors > 0 ✅
- Frontend: full Validation Dashboard with multi-role state transitions ✅

### Phase 2.5 — Missing Frontend Pages (100% Complete)
- Exit Strategies page ✅ DONE — full CRUD, DORA Art. 28§8 alignment + Collaboration Panel
- ICT Services page ✅ DONE — full CRUD, RT.05 alignment
- Validation Dashboard ✅ DONE — state machine management
- Supply Chain add/edit/delete ✅ DONE
- Dashboard real KPIs from API ✅ DONE

### Phase 3 — Register of Information / RoI Export (100% Complete)
- Parsed `RegisterInformationTemplatesIllustration.xlsx` — all column definitions extracted
- `RoiExportService` (exceljs) — **13 templates**: RT.01.01/.02/.03, RT.02.01/.02, RT.03.01, RT.04.01, RT.05.01/.02, RT.06.01, RT.07.01, RT.08.01, **RT.09.01 (Concentration Risk)**
- `GET /roi/export?template=RT.01.01` — single or full workbook Excel download
- `GET /roi/preflight` — pre-flight validation gate
- `GET /roi/export/xbrl` — XBRL OIM-CSV packaging (ZIP with metadata.json)
- **XBRL conformance**: correct DORA taxonomy URI, register reference date, type-aware formatCsvValue(), entityName/LEI from FinancialEntity record
- Frontend: RoI Export page with pre-flight + template grid + Excel/XBRL downloads
- **Deliverable**: Downloadable CBI-ready Excel / XBRL files per template ✅

### Phase 4 — Full Frontend (100% Complete)
All pages: Financial Entities ✅, Providers ✅, Contracts ✅, Functions ✅, Assessments ✅, Supply Chain ✅, ICT Services ✅, Exit Strategies ✅, Validation ✅, RoI Export ✅, Admin ✅

### Phase 5 — Multi-Tenancy & Admin (100% Complete)
- Tenant CRUD API + onboarding wizard ✅
- User invitation + role assignment ✅
- Audit Log interceptor + viewer ✅
- Concentration Risk engine + page ✅
- Editor/Analyst Contextual Notifications + Deep Linking ✅

### Phase 5.5 — Security Hardening ✅ COMPLETE (2026-04-18)
- **Refresh token rotation**: 64-byte cryptographic random token, bcrypt-hashed server-side; rotated on every use; cleared on logout/password reset ✅
- **PostgreSQL RLS**: `prisma/rls_policies.sql` applies `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + tenant isolation policies on all 14 domain tables and 6 junction tables ✅
- **`TenantIsolationMiddleware`**: NestJS middleware at `src/common/middleware/tenant-isolation.middleware.ts` sets `app.current_tenant_id` session variable at the start of every request, activating all RLS policies ✅
- **220 EBA validation rules** seeded (VR_01–VR_250) ✅
- **XBRL OIM-CSV conformance**: fixed schemaRef URI, reportingPeriod = register reference date, type-aware value formatting, entityName/LEI from primary FinancialEntity ✅

### Phase 6 — Testing (5% Complete)
- Unit tests: Validation Engine ≥ 80% coverage
- Integration tests: all API endpoints (Supertest)
- E2E tests: Login → data entry → validate → export (Playwright)

### Phase 7 — Documentation & Compliance Readiness (15% Complete)
- Swagger complete ✅ (auto-generated, needs review)
- Data dictionary ❌
- DORA Article mapping ❌
- Deployment guide ❌

---

## 6. DORA Compliance Checklist

| Requirement | Article | Implementation | Status |
|-------------|---------|---------------|--------|
| ICT third-party register | Art. 28§2 | `contractual_arrangements` | ✅ |
| Critical function identification | Art. 28§4 | `business_functions` | ✅ |
| Multi-level supply chain | Art. 28§3 | `ict_supply_chain` (supply_rank) | ✅ |
| Substitutability assessment | Art. 28§5 | `ict_service_assessments` | ✅ |
| Exit plan documentation | Art. 28§5 | `exit_strategies` | ✅ |
| Cross-border data flow | Art. 30 | `contractual_arrangements` (geo fields) | ✅ |
| Concentration risk detection | Art. 28§5 | `risk.service` engine | ✅ |
| Immutable audit trail | Art. 25 | `audit_logs` + interceptor | ✅ |
| EBA ITS validation | EBA/RTS/2024 | 220-rule validation engine | ✅ |
| CBI submission file | EBA/ITS/2023 | RoI export (Excel/XBRL ZIP, OIM-CSV conformant) | ✅ |
| RBAC access control | Art. 19 | JWT + RBAC guards | ✅ |
| Multi-tenant isolation | GDPR + DORA | tenant_id per-query + **PostgreSQL RLS** | ✅ |

---

## 7. Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| EBA template updates (ITS revisions) | High | `validation_rules` and `template_field_mapping` in DB — no hardcoding |
| Prisma schema complexity (30 tables) | Medium | Iterative `db push`, TypeScript catches drift; migration baseline deferred |
| Excel export fidelity vs EBA columns | High | Unit tests on `RoiExportService` with reference dataset |
| Performance (large tenant validation) | Medium | Queue (Bull/Redis) for async validation runs |
| GDPR compliance (LEI, entity data) | High | Tenant isolation (app-layer + **RLS**), audit logs, retention policy |
| Cross-tenant data leak | **Resolved** | PostgreSQL RLS + TenantIsolationMiddleware now enforces DB-level isolation |

---

## 8. Progress Journal

| Date | Milestone |
|------|-----------|
| 2026-03-17 | Phase 0 started — monorepo, Prisma, auth, Shadcn |
| 2026-03-22 | Core domain modules (Entities, Providers, Contracts) full-stack |
| 2026-03-26 | Business Functions + Assessments + i18n |
| 2026-03-27 | Demo seeding, architecture cleanup, 4 new backend modules |
| 2026-03-27 | Phase 1.5 COMPLETE — 15 schema + code changes, TS clean, stubs deleted |
| 2026-03-31 | Phase 3 RoI Export COMPLETE — RT.03/RT.04 added, XBRL OIM-CSV implemented |
| 2026-03-31 | Phase 5 Admin/Audit COMPLETE — Tenants, Users, Audit Interceptor, Concentration Risk |
| 2026-04-02–09 | Sessions 7–9 — Validation lifecycle fix, LEI bug fix, DORA compliance score |
| 2026-04-16 | Editor/Analyst Workflow COMPLETE — state machine, multi-role, deep-linking, notifications |
| 2026-04-17 | RT.08.01 export wired; XBRL conformance fixes; RLS policies written |
| 2026-04-18 | RLS applied to 20 tables live; TenantIsolationMiddleware registered globally |
| **2026-04-19** | **220 EBA rules seeded (VR_01–VR_250); XBRL entity identity fixed; all hardening complete** |

---

## 9. Immediate Next Actions

| # | Action | Phase |
|---|--------|-------|
| 1 | Write Unit/E2E tests | 6 |
| 2 | Deployment guide | 7 |

---

## 10. Future Work (Deferred Scope)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Bulk CSV / Template Ingestion** | Parse uploaded EBA Excel templates, map columns, import into register | High |
| **AI-Assisted Compliance** | LLM field suggestion, ICT service classification, narrative generation | Medium |
| **AI Anomaly Detection** | Statistical flagging of anomalous RoI entries | Medium |
| **Existing Template Analysis** | Reverse-ingest a prior CBI/EBA submission to pre-populate register | High |
| **Formal Prisma Migrations** | Replace `db push` with `prisma migrate` tracked files | Medium |
| **E2E Test Suite** | Playwright tests for full Login → Validate → Export flow | High |
| **Production Hardening** | CORS env var, remove JWT default, structured logging, `/health` endpoint | High |
| **MFA** | TOTP-based MFA for Admin/Analyst roles | Medium |
| **Real-Time Collaboration** | WebSocket live updates during validation remediation | Low |
