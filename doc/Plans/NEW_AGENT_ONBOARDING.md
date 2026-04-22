# NEW AGENT ONBOARDING GUIDE
**DORA SaaS Platform — Read This First**
**Last Updated: 2026-03-27**

You are joining an active development project. This file gives you everything you need to understand the system in under 5 minutes. Read it completely before writing a single line of code.

---

## What Is This?

A **multi-tenant RegTech SaaS platform** for Irish financial companies to comply with DORA (Digital Operational Resilience Act, EU 2022/2554). The platform manages ICT third-party risk registers and generates EBA-compliant export files for submission to the Central Bank of Ireland.

**This is NOT a generic SaaS. It is a regulatory compliance engine.**

---

## Critical Environment Info

| Item | Value |
|------|-------|
| Database | PostgreSQL 16, `DORA_DB`, `postgres`/`1234`, port `5432` |
| Backend | NestJS + Prisma v7.5.0, port `3000` |
| Frontend | React 18 + Vite, port `8000` |
| Node.js | v22.14.0, local install at `backend/.node/` |
| Swagger | `http://localhost:3000/api/docs` |
| Demo user | `demo@example.com` / `123456` |
| Prisma config | `backend/prisma/prisma.config.ts` (URL defined here, not `.env`) |

**To run Prisma commands:**
```bash
cd backend
.node/bin/node node_modules/.bin/prisma db push
.node/bin/node node_modules/.bin/prisma generate
.node/bin/node node_modules/.bin/tsc --noEmit   # type check
```

---

## File Map — Where to Find What

```
/doc/
  NEW_AGENT_ONBOARDING.md   ← YOU ARE HERE
  master_plan.md             ← Architecture, phases, priorities, DORA compliance checklist
  task.md                    ← Granular task checklist (✅ done / ☐ todo)
  project_snapshot.md        ← Full technical snapshot (DB schema, modules, readiness %)
  agent_instructions.md      ← Coding rules + session history log

/backend/
  prisma/schema.prisma       ← SOURCE OF TRUTH for DB schema
  src/app.module.ts          ← All active NestJS modules registered here
  src/[module-name]/         ← One directory per domain module

/frontend/
  src/pages/                 ← One .tsx file per page
  src/api/                   ← API client functions (axios-based)
  src/layouts/DashboardLayout.tsx ← Sidebar navigation (add new links here)
  src/App.tsx                ← React Router routes (add new routes here)
```

---

## The Domain Model (CRITICAL — Understand This First)

```
Financial Entity (RT.01)
  └── Branch
  └── Business Function (RT.04)  ← criticality, RPO/RTO
        └── FunctionIctDependency (many-to-many)
              └── Contractual Arrangement (RT.02)  ← THE CENTRAL HUB
                    ├── ICT Provider (RT.03)
                    ├── ICT Service (RT.05)
                    ├── ICT Supply Chain (RT.07)  ← supply_rank 1..N
                    ├── ICT Service Assessment (RT.06)
                    └── Exit Strategy (RT.08)
```

Every operation must respect this chain. A contract belongs to a financial entity and a provider. A business function links to a contract. Everything is scoped to a `tenant_id`.

---

## What Is Already Built

### Backend (NestJS Modules — Active)
| Module | Route Prefix | Status |
|--------|-------------|--------|
| AuthModule | `/api/v1/auth` | ✅ Full |
| FinancialEntitiesModule | `/api/v1/financial-entities` | ✅ Full |
| IctProvidersModule | `/api/v1/ict-providers` | ✅ Full |
| ContractualArrangementsModule | `/api/v1/contractual-arrangements` | ✅ Full |
| FunctionsModule | `/api/v1/functions` | ✅ Full |
| RiskAssessmentModule | `/api/v1/risk-assessment` | ✅ Full |
| IctServicesModule | `/api/v1/ict-services` | ✅ Full |
| IctSupplyChainModule | `/api/v1/ict-supply-chain` | ✅ Full |
| ExitStrategiesModule | `/api/v1/exit-strategies` | ✅ Full |
| ValidationModule | `/api/v1/validation` | ✅ Full (State Machine) |
| ReferenceModule | `/api/v1/reference` | ✅ Full |
| NotificationsModule | `/api/v1/notifications`| ✅ Full |
| CommentsModule      | `/api/v1/comments`     | ✅ Full |

### Frontend Pages
| Page | Route | Status |
|------|-------|--------|
| Login/Auth | `/login` etc. | ✅ |
| Financial Entities | `/entities` | ✅ |
| ICT Providers | `/providers` | ✅ |
| Contractual Arrangements | `/contracts` | ✅ |
| Business Functions | `/functions` | ✅ |
| ICT Service Assessments | `/assessments` | ✅ |
| ICT Supply Chain | `/supply-chain` | ✅ Map & Grid |
| Exit Strategies | `/exit-strategies`| ✅ |
| ICT Services | `/services` | ✅ |
| Validation Dashboard | `/validation` | ✅ |
| RoI Export | `/roi-export` | ✅ |
| Admin Panel | `/admin` | ✅ |

---

## What Is NOT Built Yet (Priority Order)

All major requirements are ✅ COMPLETE.
Currently only minor workflow tweaks and deployment tasks remain:

1. **Deployment Pipeline** — Container orchestration for production targeting.
2. **Additional Testing** — Supertest E2E automation for complex validation scenarios.

---

## Known Bugs / Inconsistencies (DO NOT IGNORE)

| Issue | Severity | Location |
|-------|----------|---------|
| Minor styling alignments in certain UI modals (mobile) | Low | Frontend Forms |
| Unsynced DB schemas on dev machines | Medium | Prisma Studio |

---

## Security Model

- Every live controller has `@UseGuards(JwtAuthGuard, RolesGuard)` at class level
- Every method has `@Roles('ADMIN', 'ANALYST', 'AUDITOR')` as appropriate
- `tenantId` comes from `req.user.tenantId` (injected by JwtStrategy from JWT payload)
- All service methods filter by `{ id, tenantId }` — NEVER query without tenant scope
- Rate limiting: 10 req / 60s via ThrottlerModule

**RBAC Matrix:**
| Action | ADMIN | ANALYST | EDITOR |
|--------|-------|---------|---------|
| Create / Update data | ✅ | ❌ (read-only) | ✅ |
| Delete data | ✅ | ❌ | ❌ |
| Read all data | ✅ | ✅ | ✅ |
| Run validation | ✅ | ✅ | ❌ |
| Export RoI | ✅ | ❌ | ✅ |
| Manage users | ✅ | ❌ | ❌ |
| Flag Validation Issue| ❌ | ✅ | ❌ |
| Review & Fix Issue | ❌ | ❌ | ✅ |

---

## How to Add a New Backend Module

1. Create `src/[name]/dto/create-[name].dto.ts` and `update-[name].dto.ts`
2. Create `src/[name]/[name].service.ts`
3. Create `src/[name]/[name].controller.ts`
4. Create `src/[name]/[name].module.ts` (import PrismaModule)
5. Add to `src/app.module.ts` imports
6. Run `.node/bin/node node_modules/.bin/tsc --noEmit` — must be 0 errors

## How to Add a New Frontend Page

1. Create `frontend/src/pages/[PageName].tsx`
2. Create `frontend/src/api/[entity].ts` (axios client functions)
3. Add route to `frontend/src/App.tsx`
4. Add sidebar link to `frontend/src/layouts/DashboardLayout.tsx`

---

## Documentation Update Protocol

**After EVERY implementation session, update these files:**

| File | When to Update |
|------|---------------|
| `doc/task.md` | Mark completed tasks ✅, add new discovered tasks |
| `doc/project_snapshot.md` | Update module status table, readiness %, implementation history |
| `doc/master_plan.md` | Update progress journal, adjust phase completion % |
| `doc/agent_instructions.md` | Add dated session entry with what was done and key decisions |

**Snapshot rule**: If you add/modify a module, DB table, API endpoint, or frontend page — update the docs before ending the session.

---

## EBA Template Files (in `/doc/`)

| File | Purpose |
|------|---------|
| `1. Template register of info at Entity level.xlsx` | EBA RoI template — RT.01 to RT.09 column definitions |
| `Draft validation rules for DORA reporting of RoI.xlsx` | EBA validation rules — must be parsed and seeded into `validation_rules` table |
| `RegisterInformationTemplatesIllustration (1).xlsx` | Sample data for testing export accuracy |

**These files have all been parsed.** Export maps templates up tracking validations per rule.

---

## Overall Project Status

**Readiness: ~100% Core Requirements Complete**

| Phase | Status |
|-------|--------|
| Infrastructure | 100% ✅ |
| Core APIs | 100% ✅ |
| Schema Hardening | 100% ✅ |
| Validation Engine | 100% ✅ |
| RoI Export | 100% ✅ |
| Frontend | 100% ✅ |
| Admin / Multi-tenancy | 100% ✅ |
| Collaborative Workflow| 100% ✅ |
| Testing | 100% ✅ |

---

*Read `master_plan.md` for the full roadmap. Enjoy maintaining the platform!*
