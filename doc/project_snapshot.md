# DORA SaaS — Comprehensive Project Snapshot
**Last Updated: 2026-04-19 | Version: 5.0**

This document is the authoritative technical snapshot of the DORA SaaS platform. Updated after every major implementation session. Primary reference for agents, developers, and academic reviewers.

---

## 1. Project Scope

**Product**: DORA SaaS — a multi-tenant RegTech platform for Irish Financial Entities to achieve compliance with the Digital Operational Resilience Act (EU 2022/2554, effective 17 January 2025).

**Core Deliverable**: A structured Register of Information (RoI) aligned to EBA ITS templates (RT.01–RT.09), validated against 220 EBA draft validation rules (EBA/RTS/2024), and exportable as Excel workbooks and XBRL OIM-CSV packages for Central Bank of Ireland (CBI) submission.

**Target Users**: SME Irish financial entities (banks, investment firms, insurance companies, payment institutions) and their internal compliance teams.

---

## 2. Technology Stack

| Layer | Technology | Exact Version |
|-------|-----------|--------------|
| Backend framework | NestJS | 11.0.x |
| Language | TypeScript | 5.9.x |
| ORM | Prisma | 7.5.0 |
| Database | PostgreSQL | 16 (Alpine) |
| Auth | Passport.js + `@nestjs/jwt` + bcrypt | jwt 11.0.2, bcrypt 6.0.0 |
| Export: Excel | ExcelJS | 4.4.0 |
| Export: ZIP (XBRL) | archiver | 7.0.1 |
| Security headers | Helmet | 8.1.0 |
| Rate limiting | `@nestjs/throttler` | 6.5.0 |
| Email | nodemailer + custom MailerModule | 8.0.4 |
| Frontend | React | 19.2.4 |
| Bundler | Vite | 8.0.0 |
| Styling | TailwindCSS | 3.4.19 |
| Component lib | Shadcn UI (Radix UI primitives) | — |
| State (auth) | Zustand | 5.0.12 |
| State (server) | TanStack Query (@tanstack/react-query) | 5.90.21 |
| HTTP client | Axios | 1.13.6 |
| Forms | react-hook-form + zod | 7.71.2 / 4.3.6 |
| Icons | lucide-react | 0.577.0 |
| i18n | i18next + react-i18next | 25.10.3 / 16.6.0 |
| Node.js | v22.14.0 | — |

**Dev Ports**: Backend `3000` — Frontend `8000`
**Swagger/OpenAPI**: `http://localhost:3000/api/docs`
**Prisma Studio**: `http://localhost:51212`

---

## 3. Database Schema (30 Tables — Source of Truth)

### Reference / Lookup Tables (seeded at startup)
| Table | Description | Entries |
|-------|-------------|---------|
| `countries` | ISO 3166-1 alpha-2 | 40 |
| `currencies` | ISO 4217 | 16 |
| `entity_types` | DORA financial entity classifications | 16 |
| `criticality_levels` | Critical / Important / Not Critical | 3 |
| `reliance_levels` | Contract reliance levels | 4 |
| `data_sensitivity_levels` | Public / Internal / Confidential / Restricted / Secret | 5 |
| `ict_service_types` | Cloud / SaaS / PaaS / IaaS / etc. | 14 |
| `provider_person_types` | Legal Person / Natural Person | 2 |
| `user_roles` | ADMIN / ANALYST / EDITOR | 3 |

### System / Security Tables
| Table | Prisma Model | Status |
|-------|-------------|--------|
| `tenants` | `Tenant` | ✅ Active |
| `users` | `User` | ✅ Active — refresh token rotation, bcrypt, HttpOnly cookies |
| `audit_logs` | `AuditLog` | ✅ Active — written by global AuditInterceptor |
| `validation_rules` | `ValidationRule` | ✅ 220 rules seeded (VR_01–VR_250) |
| `validation_runs` | `ValidationRun` | ✅ Full execution history |
| `validation_issues` | `ValidationIssue` | ✅ Stateful (OPEN→FLAGGED→FIXED→WAITING_APPROVAL→RESOLVED) |
| `notifications` | `Notification` | ✅ Cross-role push, deep-links |
| `comments` | `Comment` | ✅ Polymorphic threaded comments |

### Core DORA Domain Tables
| Table | DORA Article | EBA Template | NestJS Module |
|-------|-------------|-------------|--------------|
| `financial_entities` | Art. 28 | RT.01.01 / RT.01.02 | `financial-entities` |
| `branches` | Art. 28 | RT.01.03 | `financial-entities` |
| `ict_providers` | Art. 28§1 | RT.05.01 | `ict-providers` |
| `contractual_arrangements` | Art. 28§2, Art. 30 | RT.02.01 / RT.02.02 | `contractual-arrangements` |
| `contract_entities` | Art. 29 | RT.03.01 | `contract-entities` |
| `contract_providers` | Art. 29 | RT.03.01 | `contract-providers` |
| `entities_using_services` | Art. 29 | RT.04.01 | (via contractual-arrangements) |
| `business_functions` | Art. 28§4 | RT.06.01 | `functions` |
| `function_ict_dependencies` | Art. 28§4 | RT.06.01 | `functions` |
| `ict_services` | Art. 28§3 | RT.05.01 | `ict-services` |
| `ict_supply_chain` | Art. 28§3 | RT.05.02 | `ict-supply-chain` |
| `ict_service_assessments` | Art. 28§5 | RT.07.01 | `risk-assessment` |
| `exit_strategies` | Art. 28§8 | RT.07.01 | `exit-strategies` |
| `exit_strategy_services` | Art. 28§8 | — | `exit-strategies` |

---

## 4. Backend Modules — Current State (AppModule-registered)

```
PrismaModule               → PostgreSQL singleton, global
AuthModule                 → JWT login, register, forgot/reset password (bcrypt 10 rounds, 1-day tokens)
UsersModule                → User queries (no public controller)
FunctionsModule            → Business Functions CRUD + ICT dependency links
RiskAssessmentModule       → ICT Service Assessments CRUD
AuditLogModule             → Writes to audit_logs via AuditInterceptor (global, all mutations)
FinancialEntitiesModule    → Financial Entities + Branches CRUD
IctProvidersModule         → ICT Providers CRUD + parent hierarchy
ReferenceModule            → All lookup tables (GET-only)
ContractualArrangementsModule → Contracts full CRUD + tab-based relationship management
ContractEntitiesModule     → Contract ↔ Financial Entity junction CRUD
ContractProvidersModule    → Contract ↔ Provider (subcontractor) junction CRUD
IctServicesModule          → ICT Services full stack
IctSupplyChainModule       → Supply chain full stack + hierarchy tree query
ExitStrategiesModule       → Exit Strategies full stack
ValidationModule           → Rule engine + stateful issue lifecycle + DORA score
RoiExportModule            → Excel + XBRL OIM-CSV export, pre-flight gate
TenantsModule              → Tenant management (ADMIN only)
RiskModule                 → Geographic/concentration risk views (Dashboard)
MailerModule               → Password reset email (nodemailer)
CommentsModule             → Polymorphic threaded comments
DashboardModule            → KPI aggregates (validation score, open issues, etc.)
NotificationsModule        → Role-targeted notifications with deep-link URLs
ThrottlerModule            → Global rate limit: 10 req / 60 s
```

---

## 5. API Route Map (versioned under `/api/v1/`)

| Endpoint | Module | Role |
|----------|--------|------|
| `POST /auth/login` | AuthModule | Public |
| `POST /auth/register` | AuthModule | Public |
| `POST /auth/forgot-password` | AuthModule | Public |
| `POST /auth/reset-password` | AuthModule | Public |
| `GET /auth/me` | AuthModule | JWT |
| `GET/POST/PATCH/DELETE /financial-entities` | FinancialEntitiesModule | JWT + RBAC |
| `GET/POST /branches` | FinancialEntitiesModule | JWT + RBAC |
| `GET/POST/PATCH/DELETE /ict-providers` | IctProvidersModule | JWT + RBAC |
| `GET/POST/PATCH/DELETE /contractual-arrangements` | ContractualArrangementsModule | JWT + RBAC |
| `POST/DELETE /contract-entities` | ContractEntitiesModule | JWT + RBAC |
| `POST/DELETE /contract-providers` | ContractProvidersModule | JWT + RBAC |
| `GET/POST/PATCH/DELETE /functions` | FunctionsModule | JWT + RBAC |
| `POST/DELETE /functions/:id/dependencies` | FunctionsModule | JWT + RBAC |
| `GET/POST/PATCH/DELETE /risk-assessment` | RiskAssessmentModule | JWT + RBAC |
| `GET/POST/PATCH/DELETE /ict-services` | IctServicesModule | JWT + RBAC |
| `GET/POST/PATCH/DELETE /ict-supply-chain` | IctSupplyChainModule | JWT + RBAC |
| `GET /ict-supply-chain/chain/:contractId` | IctSupplyChainModule | JWT |
| `GET /ict-supply-chain/all` | IctSupplyChainModule | JWT |
| `GET/POST/PATCH/DELETE /exit-strategies` | ExitStrategiesModule | JWT + RBAC |
| `GET /validation/rules` | ValidationModule | JWT |
| `POST /validation/run` | ValidationModule | ANALYST |
| `GET /validation/runs` | ValidationModule | JWT |
| `GET /validation/runs/:id` | ValidationModule | JWT |
| `POST /validation/runs/:id/flag` | ValidationModule | ANALYST |
| `PATCH /validation/runs/:id/resolve` | ValidationModule | EDITOR |
| `PATCH /validation/runs/:id/approve` | ValidationModule | ANALYST |
| `PATCH /validation/runs/:id/reject` | ValidationModule | ANALYST |
| `GET /roi/export` | RoiExportModule | ADMIN |
| `GET /roi/export/xbrl` | RoiExportModule | ADMIN |
| `GET /roi/preflight` | RoiExportModule | ADMIN |
| `GET /reference/*` | ReferenceModule | JWT |
| `GET /dashboard/*` | DashboardModule | JWT |
| `GET/POST /notifications` | NotificationsModule | JWT |
| `GET/POST/PATCH/DELETE /admin/*` | TenantsModule / UsersModule | ADMIN |
| `GET /audit-logs` | AuditLogModule | ADMIN |

**Swagger**: Active at `/api/docs` — full OpenAPI 3.0 spec auto-generated by `@nestjs/swagger`.

---

## 6. Frontend — Pages and Status

| Page | Route | Status |
|------|-------|--------|
| Login | `/login` | ✅ Full |
| Forgot Password | `/forgot-password` | ✅ Full |
| Reset Password | `/reset-password` | ✅ Full |
| Dashboard (role-adaptive) | `/` | ✅ Admin / Analyst / Editor variants |
| Financial Entities + Branches | `/entities` | ✅ Full CRUD |
| ICT Providers | `/providers` | ✅ Full CRUD |
| Contractual Arrangements | `/contracts` | ✅ Full CRUD + tab-based relationship management (Business Functions / Linked Entities / Subcontractors) |
| Business Functions | `/functions` | ✅ Full CRUD + modern ICT dependency dialog |
| ICT Service Assessments | `/assessments` | ✅ Full CRUD |
| ICT Supply Chain | `/supply-chain` | ✅ Visual tree + full CRUD (ANALYST/ADMIN) |
| ICT Services | `/ict-services` | ✅ Full CRUD |
| Exit Strategies | `/exit-strategies` | ✅ Full CRUD |
| Validation Dashboard | `/validation` | ✅ Full — run, flag, fix, approve, reject workflow |
| RoI Export | `/roi-export` | ✅ Full — pre-flight, per-template, full workbook, XBRL ZIP |
| Admin Panel | `/admin` | ✅ Tenants, Users, Audit Logs (readable), Concentration Risk |

### Role-Based Sidebar Navigation
- **ADMIN**: Dashboard, Financial Entities, Users Management, RoI Export, Settings
- **ANALYST**: Dashboard, Contractual Arrangements, Validation Dashboard, Risk Assessments, Business Functions, Supply Chain, Exit Strategies
- **EDITOR**: Dashboard, ICT Providers, ICT Services, Contractual Arrangements, Exit Strategies

---

## 7. DORA Template → Export Coverage

| EBA Template | Sub | Description | DB Source | Export |
|-------------|-----|-------------|-----------|--------|
| RT.01.01 | — | Entity maintaining register | `financial_entities` + `tenants` | ✅ |
| RT.01.02 | — | Financial entities in scope | `financial_entities` | ✅ |
| RT.01.03 | — | Branches | `branches` | ✅ |
| RT.02.01 | — | Contracts (general) | `contractual_arrangements` | ✅ |
| RT.02.02 | — | Contracts (specific) | `contractual_arrangements` + relations | ✅ |
| RT.03.01 | — | Group-level contract coverage | `contract_entities` + `contract_providers` | ✅ |
| RT.04.01 | — | Entities using services | `entities_using_services` | ✅ |
| RT.05.01 | — | ICT providers | `ict_providers` | ✅ |
| RT.05.02 | ICT third-party register | Art. 28§2 | `contractual_arrangements` | ✅ |
| Critical function identification | Art. 28§4 | `business_functions` | ✅ |
| Multi-level supply chain | Art. 28§3 | `ict_supply_chain` (supply_rank) | ✅ |
| Substitutability assessment | Art. 28§5 | `ict_service_assessments` | ✅ |
| Exit plan documentation | Art. 28§5 | `exit_strategies` | ✅ |
| Cross-border data flow | Art. 30 | `contractual_arrangements` (geo fields) | ✅ |
| Concentration risk detection | Art. 28§5 | `risk.service` engine | ✅ |
| Immutable audit trail | Art. 25 | `audit_logs` + interceptor | ✅ |
| EBA ITS validation | EBA/RTS/2024 | Validation engine (220 rules) | ✅ |
| CBI submission file | EBA/ITS/2023 | RoI export (Excel/XBRL ZIP) | ✅ |
| RBAC access control | Art. 19 | JWT + RBAC guards | ✅ |
| Multi-tenant isolation | GDPR + DORA | tenant_id per-query + PostgreSQL RLS | ✅ |

**Note**: The export module declares 13 templates as `SUPPORTED_TEMPLATES` (including RT.08.01 and RT.09.01).

---

## 8. Security Architecture

| Mechanism | Status | Details |
|-----------|--------|---------|
| JWT Bearer token | ✅ | 1-day expiry, secret from env `JWT_SECRET` |
| bcrypt hashing | ✅ | 10 rounds |
| Role-based guards | ✅ | `@Roles('ADMIN','ANALYST','EDITOR')` + `RolesGuard` on every controller endpoint |
| Tenant isolation | ✅ | `tenant_id` extracted from JWT payload; injected into every Prisma query |
| Rate limiting | ✅ | 10 requests / 60 seconds globally (ThrottlerModule) |
| Security headers | ✅ | Helmet applied in `main.ts` |
| CORS | ✅ | Restricted to `http://localhost:8000` |
| Audit logging | ✅ | Global `AuditInterceptor` fires on all POST/PATCH/PUT/DELETE; writes `old_values`/`new_values` JSON diff |
| Refresh token | ✅ | 64-byte cryptographic random token, bcrypt-hashed server-side, cleared on logout/reset |
| DB-level RLS | ✅ | PostgreSQL Row-Level Security applied to 20 tables via `TenantIsolationMiddleware` |

---

## 9. Validation Engine

**Module**: `src/validation/`

- Parsed official EBA ITS rules from `/doc/Draft validation rules for DORA reporting of RoI.xlsx`
- **220 rules seeded** (VR_01–VR_250): all 10 rule types, covering RT.01–RT.08 across required, format, fk_exists, range, dropdown, cross-field, conditional, date_boundary, uniqueness, and aggregate checks
- Multi-role workflow state machine: Analysts flag, Editors fix, Analysts resolve ✅
- `POST /validation/run` executes all rules, persists to `validation_runs` and `validation_issues` ✅
- Live issue propagation inside target record UI forms (e.g., Contracts, Entities) ✅
- Pre-flight gate: Validation Dashboard blocks export if errors > 0 ✅
- Frontend: full Validation Dashboard with multi-role state transitions ✅

---

## 10. Overall Readiness Assessment

| Component | Status |
|-----------|--------|
| Data model (30 tables) | ✅ Fully implemented |
| Core CRUD APIs (all modules) | ✅ Fully implemented |
| Validation engine (10 rule types) | ✅ Fully implemented |
| RoI Export (exceljs) | ✅ 13 templates: RT.01.01/.02/.03, RT.02.01/.02, RT.03.01, RT.04.01, RT.05.01/.02, RT.06.01, RT.07.01, RT.08.01, RT.09.01 |
| RoI Export (XBRL OIM-CSV) | ✅ CBI-ready ZIP with metadata.json, schemaRef, and type-aware formatting |
| Security (auth, RBAC, RLS) | ✅ Full application-layer + DB-level isolation |
| Audit logging | ✅ Active via global interceptor |
| Multi-tenancy | ✅ tenant_id isolation on all queries |
| Automated tests | ⚠️ Partial — 9 spec files for 3 modules |

### Phase 5 — Multi-Tenancy & Admin (100% Complete)
- Tenant CRUD API + onboarding wizard ✅
- User invitation + role assignment ✅
- Audit Log interceptor + viewer ✅
- Concentration Risk engine + page ✅
- Editor/Analyst Contextual Notifications + Deep Linking ✅

### Phase 5.5 — Security Hardening (100% Complete — 19 April 2026)
- **PostgreSQL Row-Level Security (RLS)** applied to all 14 tenant-bearing tables and 6 junction tables ✅
- **`TenantIsolationMiddleware`** (`src/common/middleware/tenant-isolation.middleware.ts`) sets `app.current_tenant_id` session variable on every request, activating RLS policies ✅
- **Refresh token rotation**: 64-byte cryptographic random token, bcrypt-hashed server-side, cleared on logout and password reset ✅
- **XBRL OIM-CSV conformance**: fixed schemaRef, reportingPeriod, entity identity, and data type formatting ✅
- **220 EBA validation rules** (VR_01–VR_250) seeded across all 9 active templates ✅

### Phase 6 — Testing (5% Complete)
- Unit tests: Validation Engine ≥ 80% coverage
- Integration tests: all API endpoints (Supertest)
- E2E tests: Login → data entry → validate → export (Playwright)

### Phase 7 — Documentation & Compliance Readiness (90% Complete)
- Swagger complete ✅ (auto-generated)
- Data dictionary ✅ `/doc/data_dictionary.md`
- Validation rules mapping ✅ `/doc/validation_rules.md`
- Technical description ✅ `/doc/dora_saas_technical_description.md` (v5.0)
- Technical Q&A ✅ `/doc/technical_qa.md` (v2.0)
- Deployment guide ❌ (future work)

---

## 11. Immediate Next Actions (Priority Order)

| # | Action | Phase | Blocks |
|---|--------|-------|--------|
| 1 | Write Unit/E2E tests | 6 | CI/CD pipeline |
| 2 | Prepare deployment guide | 7 | Production readiness |

---

## 12. Future Work (Deferred Scope)

| Feature | Description | Rationale |
|---------|-------------|-----------|
| **Bulk CSV Ingestion** | Parse/validate/import EBA Excel templates | High complexity |
| **AI-Assisted Compliance** | LLM-based field suggestion/classification | Out of scope for prototype |
| **AI Anomaly Detection** | Statistical flagging of anomalous RoI data | Requires training data |
| **Formal Migrations** | Replace `db push` with `prisma migrate` | Blocked by shadow-db syntax |
| **MFA** | TOTP-based authentication | Future security hardening |

---

## 13. Implementation History

| Date | Session | Key Deliverables |
|------|---------|-----------------| 
| 2026-03-17 | Session 1 | Monorepo init, Prisma setup, JWT auth, RBAC scaffold, Shadcn UI |
| 2026-03-22 | Session 2 | DB alignment (22 tables), Financial Entities, ICT Providers, Contractual Arrangements full-stack |
| 2026-03-26 | Session 3 | Business Functions + ICT Dependencies, ICT Service Assessments, i18n |
| 2026-03-31 | Phase 3 | RoI Export COMPLETE — RT.03/RT.04 added, XBRL OIM-CSV export implemented |
| 2026-03-31 | Phase 5 | Admin/Audit COMPLETE — Tenants module, Users module+invite, global Audit Interceptor, Concentration Risk engine, Admin Panel active |
| 2026-04-16 | Phase 5 | Editor Analyst Workflow COMPLETE — Validation state machine, multi-role constraints, deep-linking, real-time comment/notification system |
| 2026-04-17 | Phase 5.5 | XBRL conformance fixes, RLS policies written, RT.08.01 export wired |
| 2026-04-18 | Phase 5.5 | RLS `rls_policies.sql` applied to 20 tables; `TenantIsolationMiddleware` registered globally |
| **2026-04-19** | **Final** | **220 EBA rules seeded; XBRL entityName/LEI from FinancialEntity; all security hardening complete** |

*This document must be updated after every implementation session.*
