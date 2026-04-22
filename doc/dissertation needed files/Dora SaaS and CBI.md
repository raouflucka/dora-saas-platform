# DORA SaaS & CBI Reporting Strategy

**Document**: How the DORA SaaS platform bridges Irish Financial Entities to the Central Bank of Ireland (CBI)  
**Last Updated**: 2026-04-19 | Version 5.0  
**Status**: Up to date with security hardening, 220 rules, 13 export templates, and XBRL OIM-CSV conformance fixes

---

## The CBI Reporting Context

As of **17 January 2025**, DORA (EU 2022/2554) is in force. Irish financial entities regulated by the **Central Bank of Ireland (CBI)** are required to submit their **Register of Information (RoI)** documenting all ICT third-party dependencies, in the format prescribed by **EBA ITS on Registers of Information (EBA/ITS/2023/02)**.

### CBI Submission Technical Requirements

| Component | Technical Specification |
|-----------|------------------------|
| **Package Format** | ZIP archive containing one CSV file per RoI template + a `metadata.json` descriptor |
| **Data Files** | One CSV per EBA sub-template (e.g., `RT_01_01.csv`, `RT_02_01.csv`) — OIM-CSV naming convention |
| **Metadata File** | `metadata.json` defining `schemaRef` (DORA taxonomy URI), `reportingPeriod`, `entityName`, `entityLei`, `submissionDate` |
| **Taxonomy** | EBA DPM (Data Point Model) for DORA — XBRL Open Information Model (OIM) format |
| **Reporting Period** | Register Reference Date = last day of the previous calendar year (e.g., `2024-12-31` for the 2025 submission) |
| **Entity Identifier** | Every reporting entity identified by its 20-character LEI (Legal Entity Identifier, GLEIF standard) |
| **Column Headers** | Two-row header: Row 1 = EBA column codes (e.g., `RT.01.01.0010`), Row 2 = human-readable labels |

### Key Regulatory Deadlines

| Milestone | Date |
|-----------|------|
| DORA legislation effective | 17 January 2025 |
| EBA dry-run / parallel-run exercise | July–September 2024 |
| First official CBI submission | April 2025 (2024 reporting period) |
| Annual recurring submission | March–April each subsequent year |

---

## How DORA SaaS Empowers Irish SMEs

Large Tier-1 banks can deploy enterprise GRC (Governance, Risk, Compliance) platforms costing €500k+. Irish SMEs — credit unions, investment firms, payment institutions, insurance companies — cannot. DORA SaaS is designed for **proportionality (DORA Art. 4)**: affordable, guided, ready to use in under an hour.

### 1. Guided Register Entry (The "TurboTax for DORA")

Instead of reading 600 pages of EBA technical standards, the SaaS interface breaks down the RT.01–RT.09 templates into logical web forms and dashboards:

- **Contextual field labels**: Every field shows its EBA column code and a plain-English description (e.g., *"LEI — required, EBA RT.01.01.0010, must be exactly 20 alphanumeric characters"*)
- **Pre-filled reference data**: ISO country codes, ISO currencies, EBA entity types, ICT service categories — all seeded and selectable from dropdowns, preventing invalid free-text entry
- **Role-based access**: Editors enter data, Analysts validate, Admins export — preventing unauthorised changes

### 2. Automated Validation Engine (220 EBA Rules)

The CBI portal applies the official EBA draft validation rules on submission. A single missing field can reject the entire submission. DORA SaaS runs these checks **before export**:

- **220 EBA validation rules** (VR_01–VR_250) covering all 9 active templates
- **10 rule types**: `required`, `format`, `dropdown`, `range`, `fk_exists`, `cross-field`, `conditional`, `date_boundary`, `uniqueness`, `aggregate`
- **5-state remediation workflow**: OPEN → FLAGGED → WAITING_APPROVAL → RESOLVED (or FIXED when data corrected)
- **Pre-flight gate**: Export is blocked until all ERROR-severity issues are resolved — no partial submissions
- **DORA Compliance Score**: Real-time percentage score showing CBI readiness level

### 3. One-Click XBRL OIM-CSV Generation (13 Templates)

Converting a relational database to the EBA OIM-CSV format is the single biggest technical barrier for SMEs. DORA SaaS automates this entirely:

| Export | Format | What it Contains |
|--------|--------|-----------------|
| Excel Workbook | `.xlsx` | One worksheet per template with EBA column codes and human-readable labels |
| XBRL OIM-CSV ZIP | `.zip` | One `.csv` per template + `metadata.json` — the intended CBI submission package |

**XBRL conformance details** (as of 19 April 2026):
- `schemaRef`: `https://www.eba.europa.eu/xbrl/dora/dict/cor` — correct DORA taxonomy URI
- `reportingPeriod`: Set to `YYYY-12-31` of the previous calendar year (the EBA register reference date)
- `entityName` + `entityLei`: Pulled from the reporting **FinancialEntity** record — not the generic tenant
- `formatCsvValue()`: All values type-formatted — dates as ISO `YYYY-MM-DD`, booleans as `"true"`/`"false"`, numbers without locale separators, PostgreSQL `CHAR(N)` padding stripped

### 4. Defence-in-Depth Security Model

Regulated financial data demands robust security. DORA SaaS implements:

| Control | Implementation |
|---------|---------------|
| Tenant isolation | `tenant_id` on all 30 domain tables; PostgreSQL RLS on 20 tables via `TenantIsolationMiddleware` |
| Authentication | JWT (15-min access) + refresh token rotation (64-byte cryptographic random, bcrypt-hashed) |
| RBAC | Three roles (ADMIN / ANALYST / EDITOR) with principle of least privilege; NestJS `RolesGuard` |
| Audit trail | Global `AuditInterceptor` writing immutable old/new value diffs to `audit_logs` (DORA Art. 25) |
| Input validation | `class-validator` + `ValidationPipe(whitelist: true)` on all DTOs |
| Security headers | `helmet()` — X-Frame-Options, HSTS, X-Content-Type-Options |
| Rate limiting | `ThrottlerModule` — 10 requests / 60 seconds globally |

---

## Data Flow: From SME UI to CBI Portal

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. INGESTION (Editor Role)                                           │
│     User enters ICT provider, contract, and service data via React    │
│     web forms. Field-level validation (client-side) on every input.   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│  2. PERSISTENCE (NestJS API / PostgreSQL)                             │
│     Data saved via Prisma to PostgreSQL (DORA_DB).                    │
│     All queries filtered by tenant_id (JWT claim + DB-level RLS).     │
│     AuditInterceptor writes mutation log entry.                        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│  3. VALIDATION (Analyst Role)                                         │
│     POST /api/v1/validation/run — applies 220 EBA rules to all        │
│     tenant data. Results stored in validation_issues with status       │
│     OPEN. Analyst reviews, flags for remediation by Editor.            │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│  4. REMEDIATION (Editor Role)                                         │
│     Editor corrects flagged data, marks issues as FIXED.              │
│     Analyst approves corrections → status: RESOLVED.                  │
│     Engine re-runs: resolved issues become FIXED automatically.       │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│  5. PRE-FLIGHT GATE (Admin Role)                                      │
│     GET /api/v1/roi/preflight — checks for any unresolved ERROR       │
│     issues. If errors > 0, export is blocked.                         │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│  6. EXPORT (Admin Role)                                               │
│     GET /api/v1/roi/export — downloads Excel workbook                 │
│     GET /api/v1/roi/export/xbrl — downloads CBI-ready XBRL ZIP       │
│     Metadata.json populated with entity LEI and register reference    │
│     date. All 13 templates included.                                   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│  7. CBI SUBMISSION (Manual)                                           │
│     Admin uploads ZIP to the CBI portal.                              │
│     EBA validation rules applied at portal level.                     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## EBA Templates Covered

| Template | Description | Status |
|----------|-------------|--------|
| RT.01.01 | Entity maintaining the register | ✅ Exported |
| RT.01.02 | Financial entities in scope | ✅ Exported |
| RT.01.03 | Branches | ✅ Exported |
| RT.02.01 | Contractual arrangements — general | ✅ Exported |
| RT.02.02 | Contractual arrangements — specific | ✅ Exported |
| RT.03.01 | Group-level contract coverage | ✅ Exported |
| RT.04.01 | Entities/branches using services | ✅ Exported |
| RT.05.01 | ICT third-party service providers | ✅ Exported |
| RT.05.02 | ICT supply chain tiers | ✅ Exported |
| RT.06.01 | Critical/important business functions | ✅ Exported |
| RT.07.01 | ICT service assessments | ✅ Exported |
| RT.08.01 | Exit strategies | ✅ Exported |
| RT.09.01 | Concentration risk | ✅ Exported |

---

## Known Limitations and Future Roadmap

| Limitation | Current State | CBI Impact | Future Fix |
|-----------|---------------|------------|------------|
| OIM-CSV DPM column completeness | Only populated columns exported; empty DPM columns omitted | Possible structural mismatch at CBI portal | Export full DPM column set per template |
| Null value representation | Empty string for null fields; no OIM nil-marker | EBA nil-handling convention varies | Implement OIM `nill:true` markers |
| No CBI portal test validation | ZIP not tested against production CBI submission portal | Submission may have format discrepancies | Test against EBA XBRL taxonomy validation tool |
| Formal migration files | `prisma db push` only; no tracked migration history | N/A for prototype; issue for production schema evolution | `prisma migrate dev` baseline |
| No template ingestion | Cannot import an existing EBA Excel/XBRL submission | Cannot pre-populate from prior submissions | Future ingestion pipeline |
| AI field classification | Manual data entry only | N/A — UX enhancement | Future AI integration |
