# DORA Article to Implementation Mapping

**Document**: Authoritative mapping of DORA Articles → System Implementation  
**Last Updated**: 2026-04-19 | Version 5.0  
**Basis**: Live codebase — `schema.prisma`, `roi-export.service.ts`, `validation.service.ts`, `prisma/seed.ts`  
**Scope**: DORA EU 2022/2554 — Chapter II (Art. 4, 11) and Chapter V (Art. 28–30) + EBA ITS on RoI (EBA/ITS/2023/02)

---

## Overview

The DORA SaaS platform is purpose-built to operationalise DORA Chapter V Articles 28–30 — the ICT third-party risk management obligations — for Irish SME financial entities. Every database table, export template, and validation rule traces back to a specific DORA Article or EBA ITS requirement. This document provides that full chain.

---

## Chapter II — ICT Risk Management Framework

### Article 4 — Proportionality Principle

> *"Financial entities shall implement the ICT risk management framework in a manner that is proportionate to their size, overall risk profile, and the nature, scale and complexity of their services, activities and operations."*

| Implementation | Component | Detail |
|----------------|-----------|--------|
| `financial_entities.total_assets` | DB field | Used to capture the proportionality indicator (asset scale) for each entity |
| `financial_entities.entity_type_id` | DB FK | Entity classification (Credit Institution, Investment Firm, etc.) determines supervisory requirements |
| `criticality_levels` reference table | DB | Three levels (Critical / Important / Not Critical) allow proportional scoping of which functions require full DORA treatment |
| Validation Engine severity | `validation_rules.severity` | Some rules are configured as `WARNING` rather than `ERROR` for lower-criticality fields, respecting the proportionality principle |
| EBA RT Column | `RT.01.01.0060` — total assets | Mandatory field in entity register; drives CBI proportionality classification |

**Validation Rules Covering Art. 4**: VR_197 (total_assets required), VR_35 (total_assets must be positive range)

---

### Article 11 — ICT Response and Recovery

> *"Financial entities shall have in place dedicated ICT business continuity policies and plans establishing how the financial entity addresses ICT disruptions for all functions. The plans shall set out the recovery time objectives (RTO) and recovery point objectives (RPO) for each essential function."*

| Implementation | Component | Detail |
|----------------|-----------|--------|
| `business_functions.rto` | DB field (INT, minutes) | Recovery Time Objective — maximum acceptable downtime for each critical function |
| `business_functions.rpo` | DB field (INT, minutes) | Recovery Point Objective — maximum acceptable data loss gap |
| `business_functions.impact_discontinuation` | DB field (TEXT) | Narrative impact analysis if function is discontinued |
| `business_functions.criticality_level_id` | DB FK | Only Critical/Important functions require RTO/RPO mandatorily |
| EBA RT Column | `RT.06.01.0050` — RTO | Exported to EBA RT.06.01 template |
| EBA RT Column | `RT.06.01.0060` — RPO | Exported to EBA RT.06.01 template |

**Validation Rules Covering Art. 11**: VR_101 (RTO required), VR_102 (RPO required), VR_226 (RPO conditional on criticality)

---

## Chapter V — Management of ICT Third-Party Risk

### Article 28 — General Principles on ICT Third-Party Risk

#### Art. 28(1) — ICT Third-Party Risk Strategy and Policy

> *"Financial entities shall manage ICT third-party risk as an integral component of ICT risk within their ICT risk management framework."*

| Implementation | Component | Detail |
|----------------|-----------|--------|
| `ict_providers` table | DB | Registry of all ICT third-party providers; every provider has `tenant_id` isolation |
| `contractual_arrangements` table | DB | Links each financial entity to its providers via formal contractual records |
| RBAC enforcement | NestJS guards | Only authorised roles can read/write ICT provider and contract data |
| Audit interceptor | `AuditInterceptor` | All changes to ICT provider and contract records are logged immutably in `audit_logs` |

**Validation Rules**: VR_63–VR_72 (provider mandatory fields), VR_46 (provider FK on contracts)

---

#### Art. 28(2) — Documenting Third-Party Dependencies

> *"Financial entities shall maintain and regularly update, at entity level, a register of information in relation to all contractual arrangements on the use of ICT services provided by ICT third-party service providers."*

| Implementation | Component | Detail |
|----------------|-----------|--------|
| Entire application | Full stack | The DORA SaaS platform **is** this register of information |
| `contractual_arrangements` | DB (central hub) | Every ICT dependency is a formal record with contract_reference, provider_id, financial_entity_id, ict_service_type, dates |
| `contract_entities` | DB (junction) | Links multiple financial entities to a single contract (group arrangements) |
| `contract_providers` | DB (junction) | Links multiple providers to a contract |
| `entities_using_services` | DB (junction) | Records which branches and entities actually consume each service |
| EBA RT | RT.02.01 + RT.02.02 | Exported via `roi-export.service.ts` — 2 sub-templates covering general and specific contract information |
| EBA RT | RT.03.01 | Group-level coverage — which entities are covered by each contract |
| EBA RT | RT.04.01 | Entity-level service usage — which entities and branches use each service |

**Validation Rules**: VR_26–VR_55 (contract fields — reference, type, dates, country, cost)

---

#### Art. 28(3) — Multi-Level Supply Chain

> *"Financial entities shall ensure that ICT third-party service providers used to support critical or important functions themselves use adequate ICT security standards. Financial entities shall maintain adequate information in relation to the whole chain of ICT third-party service providers."*

| Implementation | Component | Detail |
|----------------|-----------|--------|
| `ict_supply_chain` | DB | Self-referencing tree: `parent_chain_id` (nullable) + `supply_rank` (INT, 1 = direct sub, 2 = second tier, etc.) |
| `supply_rank` | DB field | Tracks N-th party depth explicitly (DORA Art. 28§3 N-th party traceability) |
| `ict_supply_chain.service_type_id` | DB FK | Records what service type the subcontractor provides |
| EBA RT | RT.05.02 | Exported per subcontractor per contract — 8 columns including `supply_rank` |

**Validation Rules**: VR_91–VR_92 (supply_rank required and range), VR_211 (supply chain service type fk_exists), VR_210 (supply_rank 1–20 range)

---

#### Art. 28(4) — Critical and Important Business Functions

> *"Financial entities shall identify all ICT-supported business processes, activities and tasks and shall document all ICT functions and ICT services that support critical or important functions."*

| Implementation | Component | Detail |
|----------------|-----------|--------|
| `business_functions` | DB | Named function + criticality_level + licensed_activity |
| `function_ict_dependencies` | DB (junction) | Many-to-many: which contracts/services support which functions |
| `criticality_levels` | Reference table | Critical / Important / Not Critical — DPM-aligned code list |
| `business_functions.licensed_activity` | DB field | EBA RT.06.01.0040 — which licensed activity the function supports |
| EBA RT | RT.06.01 | Exported — function name, identifier, criticality, RTO, RPO, impact, licensed activity, last assessment date |
| Validation conditional | VR_214 | `licensed_activity` required when criticality = Critical |

**Validation Rules**: VR_94–VR_103 (function fields), VR_212–VR_214 (format, conditional)

---

#### Art. 28(5) — ICT Service Substitutability and Concentration Risk

> *"Financial entities shall assess the concentration risk including the risk that a single service provider becomes a point of failure. Financial entities shall assess whether a substitutable ICT third-party service provider exists."*

| Implementation | Component | Detail |
|----------------|-----------|--------|
| `ict_service_assessments` | DB | Substitutability assessment record — one per contract/provider pair |
| `ict_service_assessments.is_substitutable` | DB BOOLEAN | Core DORA flag: can this provider/service be substituted? |
| `ict_service_assessments.substitution_reason` | DB TEXT | Required when `is_substitutable = false` (Art. 28§5 justification) |
| `ict_service_assessments.reintegration_possible` | DB BOOLEAN | Can the in-house function be reintegrated? |
| `ict_service_assessments.alternative_providers_exist` | DB BOOLEAN | Are alternative providers available? |
| `ict_service_assessments.discontinuation_impact` | DB TEXT | Consequence narrative if provider terminates service |
| Concentration Risk Engine | `GET /risk/concentration` | Aggregates providers by % of critical contracts — identifies single points of failure |
| Admin Dashboard | Dashboard concentration chart | Visual representation of provider concentration — which providers serve the most critical functions |
| EBA RT | RT.07.01 | Exported — 12 columns covering substitutability, audit dates, exit plan status, impact |

**Validation Rules**: VR_106–VR_118 (assessment fields), VR_109 (substitution_reason conditional — key business rule), VR_215–VR_217

---

#### Art. 28(8) — Exit Strategies

> *"Financial entities shall develop exit strategies in order to allow them to terminate, in an orderly manner, contractual arrangements with ICT third-party service providers in cases of disruption or failure."*

| Implementation | Component | Detail |
|----------------|-----------|--------|
| `exit_strategies` | DB | One exit strategy document per contract arrangement |
| `exit_strategies.exit_trigger` | DB TEXT | The conditions triggering the exit — DORA requires explicit definition |
| `exit_strategies.exit_strategy` | DB TEXT | The full migration/termination plan |
| `exit_strategies.fallback_provider_id` | DB FK (optional) | Named alternative provider — EBA RT.08 |
| `exit_strategies.assessment_id` | DB FK (optional) | Links back to the substitutability assessment |
| `ict_service_assessments.exit_plan_exists` | DB BOOLEAN | Quick status flag: is there a documented exit plan? |
| EBA RT | RT.08.01 | **Now exported** (19 April 2026) — exit trigger, exit plan, fallback provider, assessment link |

**Validation Rules**: VR_189–VR_192 (exit strategy fields), VR_218–VR_220 (cross-field logic), VR_191–VR_192 (narrative min-length format rules)

---

### Article 29 — Preliminary Assessment of ICT Concentration Risk

> *"When entering into contractual arrangements, financial entities shall take into account ICT concentration risk, including where ICT services cover the same group of financial entities within the same contractual arrangement."*

| Implementation | Component | Detail |
|----------------|-----------|--------|
| `contract_entities` | DB (junction) | Records which financial entities share a single contract — group arrangement tracking |
| `contract_providers` | DB (junction) | Records which providers are involved in a group contract |
| `entities_using_services` | DB (junction) | Granular: which entity or branch uses which service under which contract |
| EBA RT | RT.03.01 | Group entity coverage — exported with `financial_entity_id` and `contract_id` |
| EBA RT | RT.04.01 | Entity/branch service usage — which branches use which services |
| Concentration Risk | `risk.service.ts` | Aggregates cross-entity provider usage to surface concentration |

---

### Article 30 — Key Contractual Provisions

> *"The rights and obligations of the financial entity and of the ICT third-party service provider shall be clearly allocated and set out in writing. The contractual arrangements shall include: descriptions of services; locations of services; data protection provisions; SLA terms; governing law; termination notice periods."*

| Implementation | Component | Detail |
|----------------|-----------|--------|
| `contractual_arrangements.service_description` | DB TEXT | Written description of ICT services provided |
| `contractual_arrangements.service_country` | DB CHAR(2) | Country where services are provided |
| `contractual_arrangements.governing_law_country` | DB CHAR(2) | Jurisdiction of the contract |
| `contractual_arrangements.storage_location` | DB CHAR(2) | Country where data is stored |
| `contractual_arrangements.processing_location` | DB CHAR(2) | Country where data is processed |
| `contractual_arrangements.data_storage` | DB BOOLEAN | Whether personal/sensitive data is stored |
| `contractual_arrangements.data_sensitivity_id` | DB FK | Classification of sensitive data stored (DPM code list) |
| `contractual_arrangements.termination_notice_period` | DB INT | Days required for contract termination notice |
| `contractual_arrangements.end_date` | DB DATE | Hard contractual end/renewal date |
| `contractual_arrangements.renewal_terms` | DB TEXT | Renewal review terms |
| `contractual_arrangements.reliance_level_id` | DB FK | Level of reliance on this provider (DPM code list) |
| Audit rights | `AuditInterceptor` | All contract changes are immutably logged (DORA Art. 30 audit access) |
| EBA RT | RT.02.01 + RT.02.02 | Full contractual arrangement export — 2 sub-templates covering all Art. 30 fields |

**Validation Rules**: VR_46–VR_66 (contract specific fields), VR_48 (storage_location conditional on data_storage), VR_55–VR_57 (country dropdown), VR_203 (termination_notice_period range), VR_204 (governing_law → service_country cross-field)

---

## EBA ITS Registers of Information — Template Mapping (EBA/ITS/2023/02)

The EBA ITS on Registers of Information defines the exact export format. The DORA SaaS platform exports **13 sub-templates**, covering all of RT.01 through RT.09:

| EBA Template | Description | DORA Article | DB Tables | Status |
|-------------|-------------|--------------|-----------|--------|
| RT.01.01 | Entity maintaining the register | Art. 28(2) | `financial_entities`, `tenants` | ✅ Exported |
| RT.01.02 | Financial entities in scope | Art. 28(2) | `financial_entities` | ✅ Exported |
| RT.01.03 | Branches in scope | Art. 28(2) | `branches` | ✅ Exported |
| RT.02.01 | Contractual arrangements — general | Art. 28(2), 30 | `contractual_arrangements` | ✅ Exported |
| RT.02.02 | Contractual arrangements — specific | Art. 30 | `contractual_arrangements` | ✅ Exported |
| RT.03.01 | Group-level contract coverage | Art. 29 | `contract_entities`, `contract_providers` | ✅ Exported |
| RT.04.01 | Entities and branches using services | Art. 29 | `entities_using_services` | ✅ Exported |
| RT.05.01 | ICT third-party service providers | Art. 28(1) | `ict_providers` | ✅ Exported |
| RT.05.02 | ICT supply chain tiers | Art. 28(3) | `ict_supply_chain` | ✅ Exported |
| RT.06.01 | Critical/important business functions | Art. 28(4), 11 | `business_functions` | ✅ Exported |
| RT.07.01 | ICT service assessments | Art. 28(5) | `ict_service_assessments` | ✅ Exported |
| RT.08.01 | Exit strategies | Art. 28(8) | `exit_strategies` | ✅ Exported (19 Apr 2026) |
| RT.09.01 | Concentration risk | Art. 28(5), 29 | `RiskService` aggregation | ✅ Exported (19 Apr 2026) |

---

## Article 25 — Accountability and Audit Trail

> *"Financial entities shall ensure that management bodies are regularly reported on ICT risks and ICT-related incidents and are responsible for governance of ICT third-party risk."*

| Implementation | Component | Detail |
|----------------|-----------|--------|
| `audit_logs` | DB | Immutable append-only log; one row per mutating HTTP request |
| `AuditInterceptor` | NestJS global middleware | Fires on all POST / PATCH / PUT / DELETE across every module |
| Old/new values | `audit_logs.old_values` + `new_values` (JSONB) | Full field-level diff captured on every mutation |
| Action types | `audit_logs.action_type` | CREATE / UPDATE / DELETE / ISSUE_FLAGGED / ISSUE_APPROVED / ISSUE_REJECTED |
| Secret sanitisation | `AuditInterceptor.sanitize()` | Strips `password_hash`, `refresh_token_hash`, `reset_token` — secrets never persist in audit records |
| Audit log viewer | Frontend Admin Panel | Paginated, filterable view of all system actions by user, date, table |

---

## Article 19 — Access Control and RBAC

> *"Financial entities shall implement access control policies on the basis of the need-to-know principle."*

| Implementation | Component | Detail |
|----------------|-----------|--------|
| Three roles | `user_roles` table | ADMIN / ANALYST / EDITOR — each with explicitly scoped permissions |
| `RolesGuard` | NestJS | Every mutation endpoint decorated with `@Roles(...)` — cannot be bypassed |
| Frontend role guard | `<RoleGuard>` component | Renders `null` for unauthorised roles — Add/Edit buttons hidden from Analyst |
| JWT claims | `{ id, email, tenantId, role }` | Role embedded in JWT at login — server never trusts request body for role |
| Principle of least privilege | Design | Editors cannot export; Analysts cannot manage users; Admins cannot enter data |

---

## Security Architecture Alignment with DORA

Beyond the RoI register, the DORA SaaS platform implements a security architecture that itself reflects DORA's ICT resilience requirements:

| Security Control | Implementation | DORA / IS Alignment |
|-----------------|----------------|---------------------|
| Password hashing | bcrypt, 10 rounds | IS good practice; DORA Art. 9 (ICT security policy) |
| Short-lived access tokens | JWT, 15-minute expiry | Session hijacking mitigation |
| Refresh token rotation | 64-byte cryptographic random, bcrypt-hashed, rotated on every use | Token theft detection (reuse of old token = all sessions cleared) |
| HttpOnly cookies | Both tokens; JS-inaccessible | XSS mitigation |
| Rate limiting | ThrottlerModule: 10 req / 60 sec | Brute-force mitigation |
| Security headers | helmet() globally | XSS, clickjacking, MIME sniffing prevention |
| CORS restriction | Origin locked to `http://localhost:8000` | CSRF surface reduction |
| DB-level tenant isolation | PostgreSQL RLS on 20 tables + `TenantIsolationMiddleware` | Multi-tenant data integrity |
| Input validation | `class-validator` + `ValidationPipe(whitelist: true)` | SQL injection, prototype pollution prevention |
| SQL injection prevention | Prisma parameterised queries; raw table names validated against whitelist | OWASP Top 10 |

---

## Validation Engine — EBA Draft Validation Rules Coverage

The `validation_rules` table currently contains **220 seeded rules** (VR_01 through VR_250), sourced from the official EBA Draft Validation Rules spreadsheet (`doc/Draft validation rules for DORA reporting of RoI.xlsx`).

| Coverage Category | Rules | % of EBA Total |
|-------------------|-------|----------------|
| Mandatory field presence (required) | 85 | — |
| Format/regex checks (format) | 22 | — |
| Reference table conformance (dropdown) | 30 | — |
| Numeric boundary checks (range) | 12 | — |
| FK referential integrity (fk_exists) | 28 | — |
| Cross-field logic (cross-field) | 12 | — |
| Conditional rules (conditional) | 7 | — |
| **Implemented total** | **220** | **~73%** |
| Deferred (inter-template, advanced RT.09 rules) | ~80 | ~27% |
| **EBA draft total** | **~300** | **100%** |

---

## Future Work — Articles and Features Not Yet Implemented

| Gap | DORA / EBA Scope | Reason for Deferral |
|-----|-----------------|---------------------|
| Advanced inter-template cross-checks | EBA VR rules referencing multiple templates | Requires join-heavy SQL across template tables |
| Template ingestion (reverse import) | No DORA article — operational feature | Complex field-mapping pipeline from EBA Excel to DB |
| AI-assisted field classification | No DORA article — operational feature | Requires LLM integration; out of scope for DSR prototype |
| MFA enforcement | Art. 9 (ICT security) | TOTP integration; future security hardening |
| Formal Prisma migration history | Operational | Schema complexity blocked automated migration diff |
