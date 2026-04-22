# Competitive Analysis: DORA SaaS vs. Copla.com

When evaluating your purpose-built DORA SaaS artefact against commercial compliance platforms like **Copla.com**, it is critical to distinguish between **GRC (Governance, Risk, and Compliance) tracking** and **Deep-Domain Regulatory Reporting**. 

While both platforms target DORA, their architectural focus, scope, and technical deliverables are fundamentally different.

---

## 1. Executive Summary

* **Copla.com** is a broad **GRC & Evidence Collection Platform** combined with "CISO-as-a-Service". It is designed to help a business understand DORA, map their internal policies to the regulation, and extract system logs (e.g., from Slack/Teams) to prove they are following security best practices.
* **Our DORA SaaS** is a highly specialised **Register of Information (RoI) Engine**. It specifically tackles **DORA Article 28** (The EBA ITS mandatory templates). It is designed to ingest raw supply-chain data, dynamically validate it against 220 rigid European Banking Authority (EBA) mathematical rules, and physically compile the XBRL OIM-CSV package required by the Central Bank of Ireland (CBI).

---

## 2. Feature-by-Feature Comparison

| Feature Capability | Copla.com (Commercial GRC) | DORA RegTech SaaS (Our Artefact) |
|--------------------|----------------------------|----------------------------------|
| **Primary Scope** | General DORA Readiness, Policy Management, Gap Analysis, ISO27001 mapping. | EBA ITS RT.01–RT.09 Register Compilation & Strict Data Validation. |
| **Data Model** | Generic compliance surveys and checklist benchmarks. | 30-table normalised PostgreSQL schema mapped 1:1 to the EBA Data Model. |
| **Validation Capability** | Human-guided review, automated evidence extraction (log scraping). | **220 embedded EBA logic rules** (7 primitive types handling cross-field, referential integrity, and structural limits). |
| **Regulatory Export** | Produces internal PDF reports or dashboard metrics charting "Compliance Readiness". | Produces physical **XBRL OIM-CSV Zip files** compliant with the EBA dictionary structure, ready for CBI upload. |
| **Workflow State Machine** | Task delegation (e.g., "Write backup policy"). | Granular, field-level data remediation (Analyst flags a specific missing LEI ➔ Editor fixes that exact cell). |
| **Target Audience Focus** | CISOs, Compliance Managers needing general oversight and document templates. | Data Officers, RegTech Analysts responsible for the legal submission file. |

---

## 3. Key Architectural Divergences

### A. The "Evidence" vs. The "Data"
Copla operates at the *policy* and *evidence* layer. It connects to your SaaS stack to verify you have multi-factor authentication (MFA) turned on and that your policies exist. 
Our SaaS operates at the *taxonomic data* layer. It does not care if your policies are written; it strictly enforces that your *"Tier 1 Cloud Provider"* has a valid 20-character LEI, a registered European country code, and an attached substitution assessment, because without those exact fields, the regulator's portal will reject the submission file.

### B. The Output Artefact
A company using Copla will achieve excellent internal security hygiene and understand their gaps. However, when the Central Bank of Ireland demands the Register of Information on January 17th, 2025, Copla does not natively generate the highly complex, multi-tabular XBRL spreadsheet package required. 
Our SaaS is fundamentally designed around the **Pre-Flight Export Gate**: the entire architecture exists to ensure that every cell of data passes EBA validation *before* allowing the XBRL export button to be clicked.

### C. Rule Processing Engine
Copla relies on human consulting (their CISO-as-a-Service model) and high-level software automation to manage compliance tasks.
Our SaaS embeds the actual regulatory law into code. By implementing Row-Level Security (RLS) multi-tenancy and an abstract JSON-driven validation engine, the platform guarantees mathematical compliance with the EBA framework programmatically, without requiring manual human oversight of the data integrity.

---

## 4. Conclusion for Dissertation

If a reviewer asks how your platform compares to tools like Copla, your defense is:

> *"Copla is an excellent horizontal GRC platform for managing DORA policies and security hygiene. However, my artefact addresses the most mathematically complex, vertical challenge of DORA: **Article 28 (Register of Information)**. While a GRC tool tracks if a company is 'ready' for DORA, my platform is the actual engine that validates the structural data against 220 EBA rules and physically compiles the XBRL submission file required by the regulator."*
