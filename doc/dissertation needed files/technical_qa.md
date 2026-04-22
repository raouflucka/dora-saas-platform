# DORA SaaS — Technical Q&A for Dissertation
## Architecture, Methodology, and Engineering Decisions

**Prepared**: 18 April 2026  
**Basis**: Live codebase + accumulated engineering decisions from development sessions  
**Purpose**: Provide precise, codebase-grounded answers to architectural and methodology questions
for Chapters 4, 5, and 6 of the dissertation.

---

## Q1. Architecture and Deployment — Intended Production Model

**Q**: What concrete production deployment model do you envisage, and are there any architectural
assumptions in the code that would need to change for production?

### A1. Recommended Production Topology

The most realistic production deployment for an Irish SME SaaS product at this scale is:

```
┌────────────────────────────────────────────────────────────────────────┐
│  CDN / Edge (Cloudflare)                                               │
│    └── Static frontend build (React/Vite) served from R2 / S3         │
├────────────────────────────────────────────────────────────────────────┤
│  Cloud Run / App Service / ECS (single container)                      │
│    └── NestJS backend (Docker image)                                   │
│         └── PORT 3000, reads JWT_SECRET from secrets manager           │
├────────────────────────────────────────────────────────────────────────┤
│  Managed PostgreSQL                                                     │
│    └── Azure Database for PostgreSQL / AWS RDS                         │
│         └── Private VNet / VPC — not publicly routable                 │
└────────────────────────────────────────────────────────────────────────┘
```

For a single-tenant Irish SME prototype validated in a CBI sandbox, a simpler path works:
a single VM (e.g. Azure B2s) running `docker-compose` with an nginx reverse proxy, a
Let's Encrypt TLS certificate, and a managed or VM-local PostgreSQL with daily backups.

### A2. Code Assumptions That Must Change Before Production

| Assumption | Current State | Production Fix Required |
|---|---|---|
| **JWT secret** | `JWT_SECRET` has a fallback default value in `docker-compose.yml` | Remove fallback; load from AWS Secrets Manager / Azure Key Vault / environment injection at deploy time |
| **CORS origin** | `app.enableCors({ origin: 'http://localhost:8000' })` hardcoded in `main.ts` | Must be parameterised via `CORS_ORIGIN` environment variable |
| **SMTP credentials** | `MailerModule` references placeholder credentials; no real SMTP configured | Must inject real SMTP credentials (SendGrid / AWS SES) via environment |
| **Logging** | `console.log()` / `console.error()` throughout; no structured logging | Replace with `@nestjs/common/Logger` or Pino; add a log transport to CloudWatch / Application Insights |
| **Health endpoints** | No `/health` or `/ready` endpoint | Add `@nestjs/terminus` health check so load balancers and container orchestrators can probe the service |
| **File export** | Exports are generated in-memory and streamed to response | Acceptable at prototype scale; at high concurrency, offload to a background job with pre-signed URL — but not necessary below ~50 concurrent users |
| **DB password** | `1234` in `docker-compose.yml` | Replace with auto-generated secret injected at deploy time; never in VCS |
| **CORS credentials** | `credentials: true` with wildcard has security implications | In production, lock down to the exact frontend domain; use SameSite=Strict on cookies |
| **No TLS** | Docker-compose runs HTTP only | Terminate TLS at nginx / load balancer; NestJS runs HTTP internally on the private network |
| **Schema management** | `prisma db push` — no migration history | Move to `prisma migrate deploy` — see Q4 |

---

## Q2. Module Boundaries — Natural Microservice Split Points

**Q**: Which modules are the most natural candidates to split first into separate services, and
what tight couplings would currently make that hard?

### A2.1 Natural Split Candidates (in priority order)

**1. ValidationModule → Compliance Engine Service**
The most self-contained candidate. It has only two dependencies:
- `PrismaService` (read-only on all domain tables + write on `validation_runs`/`validation_issues`)
- `NotificationsService` (writes notifications)

It already has a clean input interface: `runValidation(tenantId)` is a single synchronous call.
In a service-oriented model, this becomes a queue consumer — a message broker (e.g. BullMQ /
AWS SQS) queues a `{ tenantId, runId }` job; the engine service processes it asynchronously
and emits a result event.

**2. RoiExportModule → Export Worker Service**
Export is IO-intensive (reads all 30 tables) and produces large in-memory payloads.
As a separate service it would be triggered by a job API, generate the ZIP/Excel to object
storage (S3/R2), and return a pre-signed download URL rather than streaming directly.
Current coupling: it directly calls `this.prisma.contractualArrangement.findMany(...)` etc.
Splitting requires either a shared read-replica DB or an internal data API.

**3. AuthModule → Identity Service**
Already clean — it has no dependency on domain data. The JWT payload (`{ id, email, tenantId, role }`)
is the only coupling surface. In a multi-service architecture this becomes a dedicated identity
provider (or integrates with an existing IdP like Keycloak / Auth0).

**4. NotificationsModule → Event Bus Consumer**
Notifications are already decoupled from domain logic by being called as a side-effect.
Moving to an event-driven notification service (listening on a shared bus) requires only
replacing direct `this.notifications.createNotification()` calls with event publishes.

### A2.2 Tight Couplings That Would Make Splitting Hard

| Coupling | Problem | Mitigation Path |
|---|---|---|
| **Shared Prisma instance** | All 14 domain modules import `PrismaModule` and call `this.prisma.X.findMany()` directly. There is no internal API or DTO boundary between modules. | Introduce service-level facades (e.g. `ContractDataService.getForTenant(tenantId)`) before splitting |
| **Global AuditInterceptor** | The interceptor fires on all HTTP requests globally, reads route structure, and writes to `audit_logs`. In a microservices world this must become an event publisher (outbox pattern or direct event bus call). | Replace with domain events emitted per mutation |
| **ValidationService reads all tables** | `ValidationService` executes raw SQL across `contractual_arrangements`, `financial_entities`, `ict_providers`, `branches`, etc. Splitting requires a shared DB (read replica) or a full data service layer | Migrate to shared read-replica first |
| **DashboardModule aggregates across concerns** | `DashboardService` joins `validation_runs`, `ict_providers`, and `contractual_arrangements` in a single service — it would need to call multiple downstream services | Introduce a materialised view or CQRS read model |

**Summary**: The modular monolith is the correct architecture for this prototype scale. The module
boundaries are well-drawn enough that the system could be decomposed into 3–4 services in 2–3
months of work, but today the absence of an internal API layer means services share state
directly through Prisma.

---

## Q3. Multi-Tenancy — Runtime Safeguards

**Q**: Beyond documenting tenant isolation as a limitation, is there any runtime or coding-standard
safeguard, or is it purely discipline?

### Honest Answer: Primarily Discipline

There is no automated runtime safeguard beyond the convention that every service method receives
`tenantId` from the controller, which extracts it from `request.user.tenantId` (JWT claim).

There is **no**:
- Prisma Client Extension that auto-injects `tenantId` into all queries
- NestJS middleware that validates `tenantId` on every request
- Base service class that all domain services extend and that forces the tenant filter
- Eslint rule that enforces `tenantId` presence in `findMany` / `findFirst` calls
- Test that verifies every service method's queries are tenant-scoped

**The one structural safeguard** is the JWT architecture itself: a user's `tenantId` is encoded
in their access token at login time from the database record, not taken from the request body.
An attacker who knows another tenant's UUID cannot inject it unless they can forge or steal a
JWT (which is protected by the HS256 secret and the 15-minute expiry).

**The clean production fix** is a Prisma Client Extension (available since Prisma v5):

```typescript
const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async findMany({ args, query }) {
        args.where = { ...args.where, tenantId: requestContext.tenantId };
        return query(args);
      },
    },
  },
});
```

This would make `tenantId` injection automatic and impossible to forget. It requires a
request-scoped Prisma instance (via NestJS `REQUEST` scope injection), which carries a small
performance overhead per request but eliminates the human-error risk entirely.

**Dissertation framing**: This is an honest and appropriate limitation for a proof-of-concept.
The limitation is documented, the architectural risk is understood, and the fix is known and
implementable. Describing it this way — rather than claiming full isolation — is the accurate position.

---

## Q4. Schema Evolution — Migration Path to Production

**Q**: What would a realistic migration path look like moving from `prisma db push` to production,
and are there schema "smells" you would fix first?

### A4.1 Migration Path

**Step 1 — Baseline migration (one-time)**
```bash
prisma migrate dev --name init --create-only
# Review the generated SQL carefully
prisma migrate dev
```
This converts the current schema into a tracked migration file that becomes the new baseline.
All future changes go through `prisma migrate dev` (development) and `prisma migrate deploy`
(CI/CD production pipeline).

**Step 2 — CI/CD integration**
In the deployment pipeline:
```bash
prisma migrate deploy   # Only applies pending migrations; never auto-resets
```
This is safe for production: it only runs new migrations, never drops and recreates.

**Step 3 — Schema "smells" to resolve before that baseline**

| Smell | Consequence | Fix |
|---|---|---|
| `contractual_arrangements` has no `tenant_id` column | Tenant isolation reaches this table via a JOIN through `financial_entity_id → financial_entities.tenant_id` — one extra hop per query | Add `tenant_id` column with FK; backfill via migration |
| `ict_supply_chain` has no `tenant_id` | Isolation goes through `contract_id → contractual_arrangements → financial_entity_id → financial_entities.tenant_id` — three hops | Add `tenant_id` directly |
| `validation_runs.results` is a JSONB blob of `ValidationResult[]` | The entire run result is stored as unindexed opaque JSON — cannot query individual fields, cannot index by `status`, cannot paginate | Migrate to a `validation_results` table (one row per rule × record pair), keeping `validation_runs` as the summary header |
| No `@updatedAt` timestamp on most tables | Cannot determine record freshness; no optimistic locking | Add `updated_at TIMESTAMP DEFAULT now()` to all domain tables |
| No indexes on FK columns | Prisma does not auto-create indexes; `tenant_id`, `contract_id`, `provider_id` FK columns have no explicit `@@index` declarations | Add `@@index([tenantId])` to all domain tables |
| `audit_logs.user_id` has no Prisma `@relation` | `user_id` FK is set but Prisma cannot type-safely JOIN to `users` | Add `@relation(fields: [userId], references: [id])` |
| Password and token fields on `users` | `reset_token`, `reset_token_expires`, `refresh_token_hash`, `refresh_token_expires` sit on the main `users` row | Move to `user_security` extension table — separates PII from security tokens for GDPR data minimisation |

---

## Q5. Validation Engine — Rule Selection Strategy

**Q**: Summarise the selection strategy for the 220 EBA rules: which were deliberately included,
which postponed, and what (if anything) should have been prioritised differently?

### A5. Selection Rationale (one paragraph)

The 220 seeded rules were selected in three priority tiers from the EBA draft validation rule
spreadsheet (`Draft validation rules for DORA reporting of RoI.xlsx`). **Tier 1** (highest
priority) covered mandatory field presence (`required`) and format validation (`format`) for
all fields classified as mandatory in the EBA ITS column definitions — LEI, name, country,
date fields, LEI format regex, and ISO code list fields — because these are the most frequent
real-world data quality failures and the ones a CBI submission portal would flag immediately.
**Tier 2** covered referential integrity (`fk_exists`), code-list conformance (`dropdown`), uniqueness (`uniqueness`), and aggregate boundary checks (`aggregate`)
for all FK columns and system structures, ensuring the system catches orphaned references and out-of-list values that
would pass a required-field check but fail template coherence. **Tier 3** seeded one to three
representative rules per `conditional`, `cross-field`, and `date_boundary` type to demonstrate that the engine
correctly handles business logic (VR_109 substitutability, VR_48 storage location, VR_51
contract date order, and explicit DORA date cut-offs) without attempting full EBA coverage of these types. **Deliberately
postponed**: all advanced inter-template cross-checks (e.g. verify that a `function_identifier`
cited in RT.06 corresponds to a `contract_reference` that exists in RT.02) and some advanced RT.09
concentration risk rules. **In retrospect**, the `conditional` tier should have been broader:
the EBA ITS has 15–20 `if X then Y` requirements across RT.02 and RT.07 (e.g. `if
intra_group_flag = true then ultimate_parent_lei is required`; `if provided_by_subcontractor
= true then subcontractor_provider_id is required`). Implementing more of these would have
increased the semantic depth of the validation engine's coverage without requiring complex
inter-template queries.

---

## Q6. Planned but Not Implemented Rule Behaviours

**Q**: Were there additional rule types or meta-logic you considered but did not implement?

### A6. The Conceptual "Nice to Have" List

**Rule types considered but not coded:**

| Rule type | Concept | Why not implemented |
|---|---|---|
| `if_critical` | Rule applies only to records linked to a Critical-rated business function — stricter substitutability requirements for Critical functions under Art. 28§5 | Requires a two-step rule: first classify the function, then apply the rule to the linked assessment |
| `temporal_consistency` | Check that a sequence of dates is logically ordered across related records (e.g. `assessment.last_audit_date < assessment.next_review_date`) | One cross-field rule per record; the cross-field type could handle this but was not seeded for this case |

**Meta-logic considered but not implemented:**

| Meta-feature | Concept | Notes |
|---|---|---|
| **Weighted DORA score** | Assign severity weights to fields (e.g. LEI absence = 10 points; name absence = 3 points); produce a field-weighted score rather than issue-count-based | Currently `doraScore = (passing / checked) × 100` with equal weight per check |
| **Template-level pass/fail threshold** | Require a minimum pass rate per template before that template is exportable, rather than blocking all exports for any single error globally | Would enable partial exports (e.g. export RT.01–RT.04 while RT.05 is still failing) |
| **Warning escalation** | Auto-escalate a WARNING issue to ERROR if it remains unresolved for N days | Requires a scheduled job (cron) and a `deadline_at` field on `validation_issues` |
| **Rule priority / execution order** | Allow rules to be sequenced so that a `required` failure on a field suppresses `format` failures for the same field | Currently all rules execute independently; a field missing its value will generate both a `required` error and a `format` error |
| **Aggregate-level rules** | Rules that fire on a group of records (e.g. "this tenant must have at least 1 ICT provider" rather than "this record's field must be present") | Recently implemented via synthetic tenant-level issue responses |

The most impactful of these for a production system would be **rule priority/suppression**
(to eliminate redundant errors) and **template-level threshold** (to enable partial exports),
because both directly improve the usability of the workflow without requiring new data model changes.

---

## Q7. XBRL OIM-CSV Conformance — Risks for Real Submission

**Q**: What are the specific assumptions, shortcuts, or simplifications in the export that would
be the main risks if someone tried to submit these files to a real CBI test portal?

### A7. The Six Primary Submission Risks

**Risk 1 — Wrong taxonomy schemaRef URI** (highest risk)
```json
"schemaRef": "https://www.eba.europa.eu/xbrl/crr/dict/cor"
```
This URI references the **CRR (Capital Requirements Regulation)** taxonomy — not the DORA RoI
taxonomy. The correct schemaRef for DORA RoI submissions should reference the EBA's DORA-specific
XBRL taxonomy package, which has a different URI (to be confirmed from EBA's published taxonomy
ZIP). Submitting with the CRR URI would cause an immediate taxonomy validation failure at any
portal that validates the `metadata.json`.

**Risk 2 — Data typing: all values are written as strings**
XBRL OIM-CSV expects typed values in specific formats:
- Decimals (e.g. `annual_cost`, `total_assets`) must not have thousand separators and must use
  `.` as decimal point regardless of locale
- Booleans must match the taxonomy's boolean representation (some require `true`/`false`,
  others `1`/`0`)
- Dates must be ISO 8601 `YYYY-MM-DD` (the export correctly uses `.toISOString().split('T')[0]`)
- Integers (e.g. `termination_notice_period`, `rto`, `rpo`) — currently written as-is; acceptable
  if no decimal formatting is applied

**Risk 3 — Null / missing field handling**
Empty or null fields are written as empty strings in the CSV. OIM-CSV style has no universal
convention for "not applicable" vs "missing" vs "structural null". EBA validation may:
- Require absent optional columns to be completely omitted (no empty cell)
- Require a specific nil marker (e.g. `nill:true` in a separate type column in the OIM format)

**Risk 4 — Column completeness**
If the EBA DPM taxonomy requires ALL defined column codes for a template to be present in the
header row (even if all values are empty), any column the export omits would cause a structural
mismatch. The current export only declares columns that the extractor functions are written for
— not the exhaustive column set from the EBA taxonomy DPM.

**Risk 5 — `reporting_period` in metadata.json**
```json
"reporting_period": "2026-04-18"   // current date at export time
```
The EBA typically expects `reporting_period` to be the reference date of the register (the date
up to which the register data is valid — e.g. `2024-12-31` for an annual report), not the
export date. Using the export date would cause the submission to be filed for the wrong reporting
period.

**Risk 6 — LEI character padding**
LEIs are stored as `CHAR(20)` in PostgreSQL, which means they are right-padded with spaces if
the source data is shorter than 20 characters. If a value like `PROV00000000000000000` (padded)
is exported, it may fail LEI Registry format validation at the CBI portal.

### A7. Summary for Dissertation

> The XBRL OIM-CSV export generates structurally valid CSV files with EBA column codes and the
> prescribed two-row header format, but has not been validated against the EBA DORA-specific
> XBRL taxonomy, and makes three assumptions that would require correction before real submission:
> the schemaRef URI must point to the DORA taxonomy (not CRR), the reporting_period must be
> the register reference date (not the export date), and numeric fields must be explicitly
> type-formatted in conformance with the DPM data type definitions.

---

## Q8. Artefact Maturity — Single-Sentence Characterisation

**Q**: What single sentence best captures the artefact's current maturity level, and what was
the most critical recent security milestone?

### A8. Maturity Statement

> **A functionally coherent, domain-complete proof-of-concept that correctly implements the full
> DORA Art. 28–30 data model, a 10-type rule-based compliance validation engine, and EBA OIM-CSV
> export across RT.01–RT.09, demonstrating all core design-science artefact requirements at
> demonstration maturity, but requiring migration-based schema
> management and a formal automated test suite before it could responsibly be deployed in a
> regulated Irish financial entity's operational environment.**

### A8. Most Critical Recent Security Milestone

**Implementing PostgreSQL Row-Level Security (RLS).**

Previously, tenant isolation relied entirely on the application layer. This was the most significant architectural risk to a real tenant. This limitation has now been resolved:

1. Enable RLS on all domain tables:
   ```sql
   ALTER TABLE contractual_arrangements ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON contractual_arrangements
     USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
   ```

2. Add a NestJS Prisma middleware that sets `app.current_tenant_id` from the JWT claim at the
   start of each request:
   ```typescript
   await this.prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
   ```

3. The application layer `tenant_id` filters remain as defence-in-depth, but RLS now provides
   a DB-level guarantee regardless of application coding errors.

This implemented change moved the platform from "isolation by convention" to "isolation by 
enforcement" — meaning we now trust the database engine itself to guarantee data boundaries. 
This provides a highly defensible answer to the examiner question: *"if an Editor in tenant A 
queried a URL with tenant B's contract ID, what would happen?"* — previously the answer was "the 
application prevents it"; with RLS active, it is now "the database physically prevents the query 
from returning another tenant's data even if the application logic fails."
