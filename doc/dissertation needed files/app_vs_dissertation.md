# DORA SaaS: App vs Dissertation — Chapter 1–3 Factual Accuracy Review

**Reviewer role**: Senior RegTech Engineer + Thesis Technical Reviewer  
**Review basis**: Live codebase audit (`schema.prisma`, `app.module.ts`, `validation.service.ts`,
`roi-export.service.ts`, `auth.service.ts`, `prisma/seed.ts`), `doc/dora_saas_technical_description.md`
(v4.0, 18 April 2026), and project development history.  
**Purpose**: Confirm which claims are safe to write as "this is what we did."  
**Key**: ✅ OK | ⚠️ PARTIAL | ❌ NOT ACCURATE

---

## CHAPTER 1 — INTRODUCTION

---

### 1.1 Background and Motivation — ✅ OK

- The system is demonstrably built for DORA Chapter V (Articles 28–30) ICT third-party RoI
  obligations, and the regulatory framing is accurate: DORA EU 2022/2554 applies from 17 January 2025.
- The motivation claim (lack of affordable, specialised RoI tooling for Irish SME financial entities)
  is a legitimate and defensible positioning argument. The system targets exactly this gap.
- No factual overclaim here. Standard academic motivational framing — safe to write.

---

### 1.2 Problem Statement — ✅ OK

- Accurately describes the system's core purpose: maintain accurate DORA-
n aligned ICT third-party
  data and generate EBA-compliant RoI templates with repeatable quality.
- The system does exactly this: a living CRUD register + validation engine + gated export pipeline.
- "Good data quality" is supported by 220 seeded validation rules (EBA VR_01–VR_250) enforcing
  presence, format, FK integrity, and conditional logic.
- Safe to write as stated.

---

### 1.3 Research Aim and Objectives — ⚠️ PARTIAL

**Safe claims:**
- Multi-tenant SaaS framework for DORA RoI — ✅ Correct. Three-tier, multi-tenant architecture confirmed.
   gtg    
   gfkdo['
   fokd
   ofk
   
   ]
  accounted for; all relevant DORA articles (28§1–§8, 29, 30, Art. 11, Art. 25) are covered.
- Validation engine embedding EBA rules — ✅ Correct. 220 rules, 10 rule types, 5-state lifecycle.
- Role-based workflows — ✅ Correct. ADMIN / ANALYST / EDITOR with enforced RBAC.

**Must qualify:**
- "Excel/XBRL suitable for CBI submission" needs careful wording. The system generates
  EBA OIM-CSV (ZIP) and Excel workbooks that follow EBA column codes and the two-row header
  convention. However, the output has **not been formally validated against the CBI submission
  portal** or the full EBA XBRL taxonomy (DPM). Safe phrasing: *"exported in EBA-prescribed
  Excel and OIM-CSV formats intended for CBI submission."*

---

### 1.4 Research Questions — ✅ OK

- "How can a logic-based architecture support automated DORA RoI validation and export for SME
  financial entities?" — directly answered by the validation engine (10 rule types, SQL-based
  executors, lifecycle state machine) and the gated export pipeline.
- "How should data model + architecture be structured for maintainability and security in a
  multi-tenant SaaS setting?" — answered by: 30-table normalised schema with tenant_id isolation,
  NestJS modular architecture (14 domain modules), Prisma ORM, JWT+RBAC, refresh token rotation.
- Both questions are well-supported by the artefact. Safe to write.

---

### 1.5 Scope and Delimitations — ⚠️ PARTIAL

**Safe claims:**
- Scoped to DORA RoI ICT third-party obligations (Art. 28–30) — ✅ Correct.
- Irish SME financial entities — ✅ Correct as stated target.  
- Proof-of-concept SaaS — ✅ Correct. Docker-compose dev environment; no cloud deployment.
- Broader DORA pillars excluded (ICT risk management Ch. II, testing Ch. IV, incident reporting
  Ch. III) — ✅ Correct. Only Chapter V is addressed.
- Large-scale performance tests excluded — ✅ Correct. No load testing.

**Must qualify:**
- "Full production hardening out of scope" is correct **but the thesis must acknowledge specific
  gaps explicitly** to be credible: no token
  revocation blacklist beyond server-side hash clearing, no formal migration history (db push only),
  no E2E test suite. If a reviewer asks "what production gaps remain?" these are the answers.

---

### 1.6 Dissertation Structure — ✅ OK

- Standard structural signpost. The mapping (Ch. 4–5 = architecture/implementation, Ch. 6–7 =
  evaluation/discussion/conclusions) is conventional and uncontroversial.
- The "design-science approach" link is appropriate — see 3.1 below.
- Safe to write.

---

## CHAPTER 2 — LITERATURE REVIEW

---

### 2.1 Regulatory Context: DORA and EU Financial Supervision — ✅ OK

- DORA EU 2022/2554, effective 17 January 2025, is the correct legislative basis.
- EBA/ITS/2023/02 (ITS on Registers of Information) is the correct technical standard for RoI
  templates RT.01–RT.09.
- The system is built directly against this regulatory baseline; citing it as the primary source
  is accurate.
- Safe to write.

---

### 2.2 ICT Third-Party Risk and Registers of Information — ✅ OK

- The literature review framing (completeness challenge, mapping templates to operational data
  structures) directly mirrors the design problem solved by the 30-table schema and the 13
  export sub-templates.
- The supply-chain traceability angle (RT.05.02 `ict_supply_chain` with `supply_rank` and
  self-referencing `parent_chain_id`) is a concrete example to cite in Ch. 4–5.
- Safe to write.

---

### 2.3 RegTech and Logic-Based Compliance — ⚠️ PARTIAL

**Safe claims:**
- "Rule engines and constraint checking over structured data fit DORA RoI" — ✅ Supported. The
  validation engine is precisely this: structured SQL-based rules per field, executed against
  the live database.
- "Explicit validation logic" — ✅ The 10 rule types (required, format, fk_exists, range, dropdown, cross-field, conditional, date_boundary, uniqueness, aggregate) encapsulate DORA-specific metadata structures mapped directly to specific articles (e.g., date rules for Jan 17, 2025).
  dropdown, cross-field, conditional) are explicitly declared, not inferred.

**Must qualify:**
- The phrase "logic-based" needs careful scoping in the thesis. The system uses a **rule-based
  architecture**, not a formal logic system (no Prolog, OWL/SHACL, Datalog, or constraint
  programming). The rules are declarative data records in the `validation_rules` table, executed
  by a custom NestJS service. If the literature review cites formal logic/constraint-programming
  work (e.g. SHACL, RuleML), the positioning must be: *"our approach is inspired by rule-based
  compliance checking but implemented as a pragmatic application-layer engine rather than a
  formal reasoning system."*
- Missing that qualifier risks an examiner challenge.

---

### 2.4 Software Architecture for Regulatory Systems — ✅ OK

- The actual architecture (NestJS layered modular monolith, Prisma ORM, separate validation and
  export modules, global audit interceptor) fits cleanly in the "layered, modular, validation
  engine, export pipeline" architectural pattern.
- Auditability: `AuditInterceptor` writes old/new values for all mutations — directly citable.
- Traceability: validation issues carry `record_id`, `table_name`, `field_name`, `dora_article`
  — direct traceability from rule → issue → DORA article.
- Safe to write.

---

### 2.5 Multi-Tenant SaaS in Financial Services — ⚠️ PARTIAL

**Safe claims:**
- "Shared-schema, app-enforced multi-tenancy" — ✅ Exactly what the system uses. `tenant_id`
  on all 30 domain tables, injected from JWT on every query.
- "Discuss trade-offs" — ✅ The primary trade-off historically was relying on application layer isolation, but the system now implements PostgreSQL Row-Level Security (RLS) to physically block cross-tenant leakage even if application logic fails.

**Must acknowledge in thesis:**
- The thesis must **explicitly state the multi-layered isolation approach**.
  Correct claim: *"Tenant isolation leverages a defence-in-depth strategy: application-layer filtering via `tenant_id` combined with database kernel-level enforcement via PostgreSQL Row-Level Security."*
- Omitting this in a thesis on financial-sector security would be a flag for examiners.

---

### 2.6 Gaps in Existing Approaches — ✅ OK

- A standard literature-positioning argument. No factual claim about the artefact — purely about
  the gap in published work and commercial tools.
- The characterisation of the DORA SaaS artefact as "combining data model, validation, and export
  in one system" is accurate: the three functions (CRUD register, validation engine, gated export)
  are all implemented and integrated.
- Safe to write.

---

## CHAPTER 3 — METHODOLOGY

---

### 3.1 Research Design and Philosophy — ✅ OK

- Design Science Research (DSR) is the correct paradigm for a project that builds an artefact to
  solve a real-world regulatory problem. The DORA SaaS platform is exactly a designed artefact
  (following Hevner et al. 2004 definition).
- The justification (design over descriptive/empirical) is defensible: the primary output is the
  artefact itself, not a survey or experiment.
- Safe to write.

---

### 3.2 Design Science Research Framework — ✅ OK

- Mapping to Hevner's six-activity DSR framework is straightforward and accurate:

  | DSR Activity | DORA SaaS Mapping |
  |---|---|
  | Problem identification | DORA RoI compliance gap for Irish SMEs |
  | Objectives | RT.01–RT.09 coverage, validation engine, role-based export |
  | Design & development | 30-table schema, NestJS API, React SPA |
  | Demonstration | Seeded demo tenant; full workflow walkthrough |
  | Evaluation | Coverage analysis, rule inspection, workflow walkthroughs |
  | Communication | Dissertation chapters 4–5 (architecture/implementation) |

- Safe to write.

---

### 3.3 Case Study: DORA SaaS for Irish SME Financial Entities — ⚠️ PARTIAL

**Safe claims:**
- The platform is the central artefact of the study.
- Bounded by specific RoI templates (RT.01–RT.09 actively), defined roles (ADMIN / ANALYST /
  EDITOR), and selected features examined in depth.

**Must qualify:**
- The word "case study" has a specific methodological meaning (Yin 2014) that implies studying
  a real-world instance. In DSR, this phase is more precisely a **"demonstration"** (showing the
  artefact works in a controlled/simulated environment).
- The system runs against **entirely synthetic seeded data** (demo tenant, generated financial
  entities, fake ICT providers). There are no real Irish SME financial entities using it.
- Recommended phrasing: *"The DORA SaaS platform constitutes the primary demonstration vehicle
  in the DSR sense, populated with synthetic data representative of real RoI entries, bounded
  by the RT.01–RT.09 template scope and three defined user roles."*
- If the methodology chapter uses the term "case study" without this qualification, an examiner
  could challenge the claim.

---

### 3.4 Data Sources and Artefacts — ✅ OK

- All named sources are real and were used:
  - **DORA and EBA texts**: regulatory basis for all field requirements and validation rules.
  - **RoI spreadsheets** (EBA ITS annexes): source for template column codes (RT.XX.XX.XXXX format).
  - **EBA Draft Validation Rules spreadsheet**: source for the 220 seeded VR codes.
  - **Codebase**: the central design and implementation artefact (`schema.prisma`, service files).
  - **Technical docs**: `doc/project_snapshot.md`, `doc/dora_saas_technical_description.md`,
    `doc/data_dictionary.md` — all maintained as living documentation.
- Safe to write.

---

### 3.5 Evaluation Strategy — ⚠️ PARTIAL

**Safe claims:**
- **Architecture reasoning** — ✅ The modular NestJS design, tenant isolation strategy, and
  security architecture can be evaluated against published principles.
- **Coverage analysis** — ✅ Template coverage (RT.01–RT.09 exported across 13 sub-templates) and rule
  coverage (220 / ~300+ EBA VR codes) are explicitly documented and quantifiable.
- **Validation rule inspection** — ✅ All 220 rules are inspectable in `prisma/seed.ts`; the
  10 rule types are implemented and documented in `validation.service.ts`.
- **Workflow walkthroughs** — ✅ The five-state issue lifecycle (OPEN→FLAGGED→WAITING_APPROVAL
  →RESOLVED/FIXED) and the pre-flight export gate are concrete, demonstrable workflows.

**Must qualify:**
- There are **no automated test results to cite**: 9 Jest spec files are scaffolded but not
  comprehensively executed with coverage metrics; no E2E or user study. The thesis must not
  imply formal experimental evidence.
- The "coverage analysis" claim for validation rules must be honest: 220 of approximately 300+
  EBA rules are seeded — **only ~37% coverage**. This must be stated explicitly in the evaluation
  as a known limitation, not elided.
- Recommended framing: *"Evaluation is performed through artefact-based methods — structural
  coverage analysis, rule inspection, and workflow demonstration — consistent with DSR evaluation
  norms. No formal user study or load testing was conducted within the scope of this dissertation."*

---

### 3.6 Ethical and Legal Considerations — ✅ OK

- **Synthetic/anonymised data only**: ✅ Confirmed. The `prisma/seed.ts` generates a "DORA Demo
  Tenant" with fictional financial entities, fake LEIs, and generated providers. No real entity
  data is used anywhere.
- **No live customer data**: ✅ Correct. The system has never been deployed to a live tenant.
- **Regulatory texts used in normal academic/professional way**: ✅ DORA, EBA ITS, and EBA
  validation rules are EU public regulatory documents. No IP or confidentiality issue.
- **Prototype disclaimer**: ✅ The system is not presented as a certified compliance tool. The
  technical description, project snapshot, and this review all explicitly state "proof-of-concept"
  and list production limitations.
- Safe to write as stated.

---

## Summary Table

| §    | Rating | Key Action Required |
|------|--------|---------------------|
| 1.1 | ✅ OK | None |
| 1.2 | ✅ OK | None |
| 1.3 | ⚠️ PARTIAL | Qualify "CBI submission" as "EBA-format output intended for CBI submission" |
| 1.4 | ✅ OK | None |
| 1.5 | ⚠️ PARTIAL | Must enumerate specific production gaps (no migration files, no E2E tests) for credibility |
| 1.6 | ✅ OK | None |
| 2.1 | ✅ OK | None |
| 2.2 | ✅ OK | None |
| 2.3 | ⚠️ PARTIAL | Must qualify "logic-based" — system is rule-based (declarative SQL rules), not formal logic (SHACL/OWL) |
| 2.4 | ✅ OK | None |
| 2.5 | ⚠️ PARTIAL | Outline both application-layer and DB-level (RLS) isolation mechanisms |
| 2.6 | ✅ OK | None |
| 3.1 | ✅ OK | None |
| 3.2 | ✅ OK | None |
| 3.3 | ⚠️ PARTIAL | "Case study" must be reframed as DSR "demonstration"; must state synthetic data only |
| 3.4 | ✅ OK | None |
| 3.5 | ⚠️ PARTIAL | No automated test results; rule coverage is ~73% (220/300+) — must be stated honestly in evaluation |
| 3.6 | ✅ OK | None |

---

## Critical Qualifications to Carry Into Writing (summary)

1. **RT.09 Coverage**: RT.01–RT.09 are fully implemented and exported across 13 sub-templates (including RT.09.01 for concentration risk).

2. **EBA output format**: Say "Excel workbooks and EBA OIM-CSV packages aligned with EBA column
   codes" — not "XBRL-validated output" or "CBI-certified export."

3. **"Logic-based"**: Say "rule-based validation engine with declarative EBA validation rules
   — not a formal logic or constraint-programming system."

4. **Tenant isolation**: Say "application-layer tenant isolation via `tenant_id` combined with PostgreSQL Row-Level Security (RLS) via a NestJS injection middleware for defence-in-depth."

5. **"Case study"**: Say "demonstration artefact (DSR sense), using synthetic seeded data" —
   not "case study with real organisational participants."

6. **Evaluation scope**: Say "artefact-based evaluation: coverage analysis, rule inspection,
   workflow demonstration — no formal user study or load testing" and cite the 220/300+ VR
   coverage gap honestly.

---

## A. Information Security Scope Alignment

### Does this artefact fit a dissertation in Network and Information Security?

Yes — strongly and at multiple levels. DORA itself is an **information security and ICT resilience
regulation**. The DORA SaaS artefact operationalises that regulation, and in doing so it
implements a concrete, layered information security architecture. The alignment exists at three
distinct levels.

---

### A.1 DORA as an Information Security Regulation

DORA (EU 2022/2554) is not a data-protection regulation (that is GDPR). It is an **ICT operational
resilience and third-party risk governance regulation** — the core subject matter of information
security. This dissertation addresses Art. 28–30 specifically — the third-party ICT risk register
domain, which sits within the IS field of:

| DORA Requirement | IS Domain |
|---|---|
| Art. 28–30: ICT third-party risk management | Third-party and supply chain security |
| Art. 6–16: ICT risk management (out of scope here) | Information risk management |
| Art. 17–23: ICT incident reporting (out of scope) | Incident response and management |
| Art. 24–27: Resilience testing (out of scope) | Security testing and assurance |

The in-scope Art. 28–30 domain requires:
- **Identifying and classifying ICT dependencies** (supply chain visibility — RT.05.02)
- **Assessing ICT provider substitutability** (resilience — RT.07.01)
- **Documenting exit strategies** (business continuity / DR — RT.08.01)
- **Ensuring contractual security provisions** (governing law, data location, notice periods — RT.02.02)

---

### A.2 Security Elements Implemented in the DORA SaaS Artefact

The system implements security controls at five layers:

#### Layer 1: Authentication and Session Security

| Control | Implementation | Code Location |
|---|---|---|
| Password hashing | bcrypt, 10 salt rounds | `auth.service.ts` |
| Short-lived access tokens | JWT, 15-minute expiry | `auth.service.ts` |
| Refresh token rotation | 64-byte cryptographic random, bcrypt-hashed server-side; rotated on every use | `auth.service.ts`, `schema.prisma` |
| Token theft detection | Invalid raw token for valid userId → stored hash immediately cleared, all sessions terminated | `auth.service.ts:76` |
| HttpOnly cookies | Both tokens set as HttpOnly — inaccessible to JavaScript / XSS | `auth.controller.ts` |
| Scoped cookie path | Refresh cookie scoped to `/api/v1/auth` — never sent on data API calls | `auth.controller.ts` |
| Server-side logout | `POST /auth/logout` clears hash in DB — true session termination, not just client-side | `auth.service.ts` |
| Password reset invalidation | Resetting password also clears all active refresh tokens | `auth.service.ts` |

#### Layer 2: Authorisation and RBAC

| Control | Implementation |
|---|---|
| Three named roles | ADMIN / ANALYST / EDITOR — clearly scoped write permissions per module |
| Controller guards | Every mutation endpoint: `@Roles(...)` + `RolesGuard` — backend cannot be bypassed |
| Frontend role guards | `<RoleGuard allowed={[...]} />` renders `null` for unauthorised roles |
| Principle of least privilege | Editors cannot export; Analysts cannot manage users; Admins have no data-entry role |

#### Layer 3: Data Integrity and Input Validation

| Control | Implementation |
|---|---|
| DTO validation | `class-validator` + `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` |
| SQL injection prevention | All Prisma queries parameterised; `$queryRawUnsafe` validates table names against hardcoded whitelist |
| Referential integrity checks | `fk_exists` rule type verifies cross-table references the validation engine cannot assume from FK constraints |
| Code-list enforcement | `dropdown` rule type forces data into EBA-defined code lists at application layer |
| Conditional logic enforcement | `conditional` rule type enforces complex EBA business rules (e.g. VR_109: substitution reason required when not substitutable) |

#### Layer 4: Auditability and Compliance Traceability

| Control | Implementation |
|---|---|
| Immutable audit log | Global `AuditInterceptor`: captures old/new values for every mutating request → append-only `audit_logs` |
| DORA Art. 25 alignment | Logs record `action_type`, `table_name`, `record_id`, `user_id`, `old_values` (JSONB), `new_values` (JSONB) |
| Issue lifecycle audit | `ValidationService` writes `ISSUE_FLAGGED`, `ISSUE_MARK_FIXED`, `ISSUE_APPROVED`, `ISSUE_REJECTED` directly to audit logs |
| Secret sanitisation | `AuditInterceptor.sanitize()` strips `passwordHash`, `resetToken`, `refreshTokenHash` — secrets never persist in audit records |
| Tenant isolation | Every query: `where: { tenantId }` from JWT — prevents cross-tenant data leakage at application layer |

#### Layer 5: Transport and Infrastructure Controls

| Control | Implementation |
|---|---|
| Security headers | `helmet()` globally — X-Frame-Options, X-Content-Type-Options, HSTS, CSP defaults |
| CORS | Restricted to `http://localhost:8000` with `credentials: true` |
| Rate limiting | `ThrottlerModule`: 10 req / 60 sec globally — mitigates brute-force and enumeration |
| Docker network isolation | Backend and PostgreSQL communicate over internal bridge network; DB port not publicly exposed |

---

### A.3 How to Frame This in the Dissertation

Position the artefact at **the intersection of two IS domains**:

1. **Regulatory IS Governance**: DORA Art. 28–30 third-party ICT risk management, data register
   completeness, and compliance reporting — relevant to IS risk management frameworks
   (ISO 27001, NIST CSF, DORA itself).

2. **Secure Design Engineering**: The artefact demonstrates a secure multi-tenant architecture
   with authentication, RBAC, audit logging, input validation, and token security — all standard
   IS engineering principles applied in a regulated financial services context.

> Suggested Ch. 4 framing: *"Security is a first-class concern in the DORA SaaS architecture.
> The system implements a layered security model spanning authentication (JWT + bcrypt + rotating
> refresh tokens), authorisation (RBAC via NestJS guards), input integrity (DTO validation + SQL
> injection prevention), and accountability (immutable audit logging per DORA Art. 25)."*

---

## B. Clarification: What "Seeded" Means — Two Distinct Things

The word "seeded" is used for **two completely different purposes** in the DORA SaaS codebase.
This distinction is critical for the dissertation.

---

### B.1 The Seed Script — What It Does

`prisma/seed.ts` is a **database initialisation script** run once via `npm run seed` during
environment setup. It performs two entirely separate jobs:

```
npm run seed
   │
   ├── 1. VALIDATION RULES  →  inserts 220 rule DEFINITIONS into `validation_rules` table
   │         These are the CHECK CRITERIA the engine applies to all operational data.
   │         They are NOT errors. They are the instructions loaded into the engine.
   │
   └── 2. DEMO OPERATIONAL DATA  →  inserts representative data records
              (financial entities, ICT providers, contracts, business functions,
               assessments, exit strategies — including intentional errors for testing)
```

---

### B.2 The Validation Rules — What They Actually Are

Each seeded validation rule is a **rule definition record** stored in the `validation_rules`
table. When an Analyst triggers "Run Validation", the engine loads these records and applies
each one as a SQL query against the real operational data.

Example rule records in the database after seeding:

```
templateName | fieldName | ruleType | ruleValue               | errorMessage                    | severity
-------------+-----------+----------+-------------------------+---------------------------------+---------
RT.01.01     | lei       | required | financial_entities      | LEI is mandatory (EBA VR_01)    | ERROR
RT.01.01     | lei       | format   | ^[A-Z0-9]{18}[0-9]{2}$ | LEI must be 20 chars (VR_02)   | ERROR
RT.05.01     | lei       | required | ict_providers           | Provider LEI mandatory (VR_61)  | ERROR
RT.07.01     | substitution_reason | conditional | ...       | Reason required when not sub (VR_109) | ERROR
```

**These are NOT injected errors. They are the rules — the criteria used to DETECT errors.**
Think of them as the checklist loaded into the engine before it scans the register.

---

### B.3 The Demo Data — Intentional Errors Explained

Separately, the seed script inserts **demonstration operational data** with a small number of
**deliberately injected errors** to prove the validation engine detects them correctly.
These are explicitly commented in `prisma/seed.ts`:

| Injected Error | Seed Location | EBA Rule Triggered |
|---|---|---|
| `legalName: null` for Microsoft Azure | `seed.ts:264` | VR_63 — Provider legal name required |
| `startDate: null` for Contract CTX-1003 | `seed.ts:288` | VR_26 — Contract start date mandatory |
| `endDate < startDate` for Contract CTX-1002 | `seed.ts:289` | VR_51 — End date must be after start date |
| `storageLocation: null` when `dataStorage=true` for CTX-1004 | `seed.ts:308` | VR_48 — Storage location required |
| LEI not matching `^[A-Z0-9]{18}[0-9]{2}$` for financial entity | `seed.ts:222` | VR_02 — LEI format check |
| `substitutionReason: null` when `isSubstitutable=false` on assessments | `seed.ts:386` | VR_109 — Conditional logic |

**Why are these errors injected?**
- **Engineering purpose**: Verify the engine correctly identifies non-compliant data across all
  10 rule types under real conditions.
- **Dissertation demonstration purpose**: After running seed + validation, the Analyst dashboard
  immediately shows these issues with their exact EBA VR code, DORA article, affected field,
  and record ID — demonstrating the artefact's detection capability end-to-end.

---

### B.4 Why 220 Rules, Not 300+? — Scope, Not Omission

The EBA draft validation rules spreadsheet (`Draft validation rules for DORA reporting of RoI.xlsx`,
available on the EBA official website) contains approximately 300+ individual rules covering
all RT.01–RT.09 templates. These rules come directly from this official EBA source — they were
not invented for this project.

**The 220 rules implemented represent a deliberate scope selection:**

| Selection Criterion | Rules Included |
|---|---|
| Templates in scope | RT.01–RT.09 (RT.09.01 exported via RiskService aggregation) |
| All 10 rule types represented | required, format, fk_exists, range, dropdown, cross-field, conditional, date_boundary, uniqueness, aggregate — all implemented |
| Priority | Mandatory field checks (ERROR severity) first, then format, referential, conditional |
| Excluded | Advanced inter-template cross-checks; Some advanced RT.09 concentration risk validation rules |

**The 220 rules do NOT cover only ICT providers.** They cover all active templates:

| Template | Rule Count | Subject Area |
|---|---|---|
| RT.01.01 / .02 / .03 | 24 | Financial entities and branches |
| RT.02.01 / .02 | 27 | Contractual arrangements |
| RT.05.01 | 13 | ICT third-party service **providers** |
| RT.05.02 | 5 | ICT **supply chain** tiers |
| RT.06.01 | 12 | Business functions (criticality, RTO/RPO) |
| RT.07.01 | 12 | ICT service **assessments** |
| RT.08 | 6 | Exit strategies |
| RT.05 (ict_services) | 9 | Internal ICT service asset register |
| **Total** | **220** | |

Correct dissertation claim: *"220 of approximately 300+ EBA draft validation rules are
implemented, covering the RoI templates (RT.01–RT.09) and representing all
seven rule type categories. Advanced inter-template cross-checks and some advanced RT.09 rules are deferred
to future work."*

---

## C. The Artefact as a White Box

### Why It Is Explicitly Not a Black Box

A **black-box** artefact produces outputs whose internal logic is opaque — inputs and outputs
are observable but the decision process is not. An AI/ML compliance classifier is a black box.

The DORA SaaS is the **opposite of a black box**: every decision, check, and data transformation
is explicit, inspectable, and directly traceable to a regulatory source. This is not accidental —
DORA Art. 25 mandates auditability and accountability, and the artefact reflects that requirement
in its own design.

---

### C.1 Five Dimensions of Transparency

#### 1. Every Validation Decision Is Traceable to a Named Rule and Regulation

When the engine flags an issue, the `validation_issues` record contains:

```
rule_id       → FK → validation_rules row:
                     templateName = 'RT.05.01'
                     fieldName    = 'legal_name'
                     ruleType     = 'required'
                     doraArticle  = 'Art.28(1)'
                     errorMessage = 'Provider legal name required (EBA VR_63)'

table_name    = 'ict_providers'
field_name    = 'legal_name'
record_id     = <UUID of the Microsoft Azure provider row>
```

A reviewer can follow the full chain:
```
ValidationIssue → validation_rules → ict_providers.legal_name IS NULL → DORA Art.28(1)
```
There is no hidden scoring. Every flag has a named rule, a named field, a named regulation,
and a named database record.

#### 2. All Rule Logic Is Declared as Data — No Hidden Code per Rule

220 rules are stored as plain records in `validation_rules`. The `ruleType` field selects one
of seven named SQL executors in `ValidationService`. Each executor is a transparent SQL query:

- **`required`**: `SELECT id FROM {table} WHERE tenant_id=$1 AND ({field} IS NULL OR {field}::text='')`
- **`format`**: fetch all non-null values → test each against the regex in `rule_value`
- **`fk_exists`**: query referencing table for rows where FK column does not resolve in target table
- **`range`**: compare field value to min/max extracted from `rule_value`
- **`dropdown`**: verify FK column value exists in the named reference table
- **`cross-field`**: `SELECT id FROM {table} WHERE NOT ({field1} {op} {field2})`
- **`conditional`**: fetch records where trigger condition true → check required field is populated

Any reviewer can read `validation.service.ts` and understand exactly what each check does
without any ML or probabilistic knowledge.

#### 3. The Export Mapping Is Fully Explicit

`roi-export.service.ts` contains `TemplateDef` objects for all 13 sub-templates. Each
`ColumnDef` explicitly states:
- EBA column code (e.g. `RT.02.02.0120`)
- Human-readable label (e.g. `"Governing law country"`)
- Extractor function (e.g. `(r) => r.governingLawCountry`)

The path `database column → EBA column code → export file value` is fully readable.
There is no hidden transformation.

#### 4. The Issue Lifecycle Is a Deterministic State Machine

```
OPEN  →[Analyst flags + comment]→  FLAGGED  →[Editor submits note]→  WAITING_APPROVAL
                                                                          ↓          ↓
                                                               [Analyst approves] [Analyst rejects]
                                                                    RESOLVED        FLAGGED (loop)

[Rule no longer fires on re-run] → FIXED  (auto-closed by engine)
```

Every transition is recorded in `audit_logs` with the user, timestamp, and old/new state.
No probabilistic or ambiguous transition exists.

#### 5. The Security Architecture Is Fully Inspectable

Every security decision is visible in code — not configured in a black-box cloud service:
- JWT signing + expiry: `auth.service.ts` — explicit constant `'15m'`
- bcrypt rounds: `bcrypt.hash(raw, 10)` — explicit constant `10`
- Refresh token entropy: `crypto.randomBytes(64)` — inspectable source
- RBAC guard logic: `roles.guard.ts` — explicit string comparison
- Audit log trigger conditions: `audit.interceptor.ts` — conditions and excluded routes listed

---

### C.2 How the Artefact Directly Answers the Research Questions

#### RQ1: How can a logic-based architecture support automated DORA RoI validation and export?

| RQ Component | Artefact Evidence |
|---|---|
| "Logic-based architecture" | 220 declarative rules in `validation_rules` table; 10 SQL executor types declared in `ValidationService`; each rule cites DORA article — logic is explicit and auditable |
| "Automated validation" | `POST /validation/run` → full pass of all active rules against all tenant data → results stored with severity, status, record_id, field_name, doraArticle |
| "Export" | `GET /roi/export` → Excel with EBA column codes; `GET /roi/export/xbrl` → OIM-CSV ZIP; pre-flight gate blocks export when ERROR-severity unresolved issues remain |
| "SME financial entities" | Single-tenant onboarding; demo tenant is an Irish SME (`country: 'IE'`); no enterprise-scale infrastructure required |

#### RQ2: How should the data model and architecture be structured for maintainability and security?

| RQ Component | Artefact Evidence |
|---|---|
| "Data model" | 30-table normalised schema; self-referencing FKs for provider hierarchy and supply chain tree; junction tables for all many-to-many relationships |
| "Architecture" | 14-module NestJS monolith; each module encapsulates controller + service + DTO; explicit injection, no circular dependencies |
| "Maintainability" | Prisma ORM — schema changes via `db push`/`generate`; TanStack Query — single cache invalidation refreshes all dependent views; validation rules are data (editable without redeployment) |
| "Security" | JWT + bcrypt + refresh token rotation; RolesGuard on all controllers; `tenant_id` on all queries; `AuditInterceptor` — immutable audit logs; helmet + throttler |
| "Multi-tenant" | Shared schema + `tenant_id` isolation — appropriate for SME prototype scale |

---

### C.3 How the Artefact Closes the Gap Identified in Chapter 2

| Gap Component | How the Artefact Closes It |
|---|---|
| **DORA-specific** | Every table, rule, and export column maps to a DORA article and EBA column code. Not a generic compliance tool. |
| **RoI-focused** | 13 sub-templates (RT.01.01–RT.09.01) in EBA-prescribed format with two-row header structure (EBA codes + human-readable labels). |
| **Rule-based validation** | 220 declarative rules, 10 rule types, 5-state remediation lifecycle. Errors are tracked, assigned, approved, and audit-logged — not just displayed. |
| **SME-tailored** | Simple three-role model; web-based CRUD forms; Docker-compose deployment; no enterprise infrastructure required. |
| **Integrated (not siloed)** | CRUD register, validation engine, and export operate on the same database. Pre-flight gate couples validation directly to export — non-compliant registers cannot be exported. This integration does not exist in spreadsheet-based approaches. |
| **Transparent/auditable** | Every decision is traceable to a named rule, a named field, a named DORA article, and a named database record — directly addressing the auditability requirement of Art. 25. |
