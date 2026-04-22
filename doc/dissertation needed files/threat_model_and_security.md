# DORA SaaS — Threat Model & Security Profile

**Version**: 1.0  
**Status**: Production-Hardened  
**Objective**: Demonstrate enterprise-grade security posture required for RegTech applications handling sensitive financial registers (DORA Art. 28-30).

---

## 1. STRIDE Threat Model Analysis

The platform mitigates core security risks using the **STRIDE** methodology, aligning directly with regulatory expectations for multi-tenant SaaS.

| Threat Category | Risk in DORA Context | Implemented Mitigation |
|-----------------|----------------------|------------------------|
| **S**poofing | Attacker impersonates an Admin or Editor to falsify CBI register submissions. | **Secure Authentication**: 64-byte cryptographic refresh tokens, bcrypt-hashed passwords (10 rounds), and short-lived JWTs (15 min). |
| **T**ampering | Malicious actor modifies a contract end date to mask compliance failures. | **Validation & Interceptors**: Strict API validations (Class-validator) reject malformed payloads. |
| **R**epudiation | User denies changing an ICT provider's criticality rating. | **Immutable Audit Trail**: `AuditLogInterceptor` captures every POST/PUT/DELETE payload, logging `user_id`, `record_id`, and `old/new values`. |
| **I**nformation Disclosure | Tenant A accidentally or maliciously views Tenant B's sensitive contracts. | **PostgreSQL RLS**: Row-Level Security at the DB engine ensures no query can return cross-tenant data, immune to application-layer JOIN bugs. |
| **D**enial of Service | API spam prevents compliance dashboard from compiling. | *(Out of Scope for PoC)* Designed to be mitigated by an external API Gateway (e.g., AWS WAF / Cloudflare) in production. |
| **E**levation of Privilege | An Analyst attempts to alter data (restricted to Editors/Admins). | **RBAC Guards**: NestJS `@Roles()` decorators enforce strict controller-level access based on the user's DB role. |

---

## 2. Core Security Mechanisms in Detail

### 2.1 Multi-Tenant Isolation (Row-Level Security)
Traditional SaaS relies strictly on `WHERE tenant_id = X` in application code. If a developer forgets the WHERE clause in a custom JOIN, data bleeds across tenants. DORA SaaS implements **Database-Level RLS**:
- `TenantIsolationMiddleware` extracts `tenant_id` from the verified JWT and executes `SET SESSION current_tenant_id = '...'`.
- PostgreSQL natively appends the policy `tenant_id = current_setting('app.current_tenant_id')` to **every single physical read/write on the disk**.

### 2.2 Token Protection (Refresh Token Rotation)
To protect against token theft:
- User logins generate an Access Token (15 mins) and a Refresh Token (7 days).
- The Refresh Token is cryptographically hashed (`bcrypt`) before saving to the DB.
- **Rotation**: On every use, the old refresh token is burned and a new one is issued. If an attacker steals a token and the legitimate user uses it simultaneously, the backend detects the breach and revokes all sessions.

### 2.3 Comprehensive Audit Logs (Art. 25 Alignment)
Regulators demand traceability. Every modifying API call flows through an `AuditInterceptor` that automatically records:
- Who made the change (`user_id`).
- What table they hit (`table_name`).
- The specific delta (`old_values` vs `new_values` JSONs).
This transforms the DORA Register from a static table into an auditable ledger.
