# Dissertation Methodology & Architecture Diagrams

This document contains **Mermaid.js** diagrams representing the exact structures you need for your dissertation. You can screenshot these directly if your Markdown viewer (like GitHub or VSCode) supports Mermaid, or you can copy the code blocks into [Mermaid Live Editor](https://mermaid.live/) to export pristine, high-resolution PNG/SVG files for your Word/LaTeX document.

## 1. DSR Methodology Process (Peffers et al. Model)
**Where to use:** Chapter 3 (Methodology).
**Why you need it:** Proves you followed a formal academic Design Science Research framework.

```mermaid
flowchart TD
    A[1. Problem Identification] -->|DORA compliance burden on SMEs| B[2. Define Objectives]
    B -->|Automated, Rule-based, Multi-tenant SaaS| C[3. Design & Development]
    C -->|NestJS / React / Postgres / Validation Engine| D[4. Demonstration]
    D -->|Seeded Validation Rules & EBA Export| E[5. Evaluation]
    E -->|Artefact-based evaluation vs EBA Rules| F[6. Communication]
```

## 2. High-Level System Architecture (C4 Container Style)
**Where to use:** Chapter 4 (System Architecture).
**Why you need it:** A standard view of the 3-tier architecture and security boundary.

```mermaid
flowchart LR
    subgraph Users
        U1[Analyst]
        U2[Editor]
        U3[Admin]
    end

    subgraph Frontend Tier
        SPA[React SPA\nVite + Tailwind]
    end

    subgraph Application Tier (NestJS)
        Auth[Auth Module\nJWT + Refresh]
        VAL[Validation Engine]
        EXP[RoI Export Module\nExcel + JSON]
        CRUD[Domain Modules\nContracts, Entities, etc.]
    end

    subgraph Data Tier (PostgreSQL)
        DB[(DORA_DB\nPrisma + DB-Level RLS)]
    end
    
    CBI[Central Bank of Ireland\nXBRL OIM-CSV]

    Users -->|HTTPS / REST| SPA
    SPA -->|API Requests| Auth
    SPA -->|API Requests| VAL
    SPA -->|API Requests| EXP
    SPA -->|API Requests| CRUD
    
    Auth <-->|Read / Write| DB
    VAL <-->|SQL Rule Execution| DB
    EXP <-->|Aggregate| DB
    CRUD <-->|Mutate| DB
    
    EXP -->|Download ZIP| CBI
```

## 3. The Validation Engine Sequence Diagram
**Where to use:** Chapter 4 or 5 (Validation Engine deep-dive).
**Why you need it:** Proves the system is a declarative "Rule Engine" not just hardcoded if-statements.

```mermaid
sequenceDiagram
    participant UI as Analyst Dashboard
    participant API as ValidationController
    participant Engine as ValidationService
    participant DB as PostgreSQL

    UI->>API: POST /validation/run
    API->>Engine: runValidation(tenantId)
    
    Engine->>DB: Fetch active rules from [validation_rules]
    DB-->>Engine: Returns 220 rules (JSON)
    
    loop For Each Rule
        Engine->>Engine: Map ruleType to SQL Template (e.g. 'required')
        Engine->>DB: Execute parameterized SQL query
        DB-->>Engine: Return failing record IDs
    end
    
    Engine->>DB: Calculate & Store DORA Score
    Engine->>DB: Write to [validation_issues]
    DB-->>Engine: Success
    
    Engine-->>API: Return ValidationRun aggregate
    API-->>UI: 200 OK (Render Score & Findings)
```

## 4. Issue Lifecycle State Machine
**Where to use:** Chapter 4 (Workflow Design) or Demonstration chapter.
**Why you need it:** Formalizes the remediation workflow mapping the roles (Analyst vs Editor).

```mermaid
stateDiagram-v2
    [*] --> OPEN : Validation Engine flags issue
    
    OPEN --> FLAGGED : Analyst (Adds Comment)
    FLAGGED --> WAITING_APPROVAL : Editor (Submits Fix in UI)
    
    WAITING_APPROVAL --> FLAGGED : Analyst (Rejects Fix)
    WAITING_APPROVAL --> RESOLVED : Analyst (Approves Fix)
    
    OPEN --> FIXED : Validation Engine (Auto-clear on rerun)
    FLAGGED --> FIXED : Validation Engine (Auto-clear on rerun)
    
    RESOLVED --> [*] : Excluded from future runs
    FIXED --> [*] : Dropped from dashboard
```

## 5. Token Rotation & Session Security Workflow
**Where to use:** Chapter 4 (Security Architecture section).
**Why you need it:** Proves you implemented robust security beyond basic JWTs.

```mermaid
sequenceDiagram
    participant SPA as React Frontend
    participant API as NestJS Backend
    participant DB as PostgreSQL
    
    SPA->>API: POST /auth/login (Credentials)
    API->>DB: Verify password hash
    DB-->>API: Match
    API->>API: Generate AccessToken (15m) & RefreshToken (7d)
    API->>DB: Store bcrypt hash of RefreshToken
    API-->>SPA: Return tokens (Cookies/Local)
    
    Note over SPA,API: 16 minutes later...
    
    SPA->>API: GET /api/v1/contracts (Expired AccessToken)
    API-->>SPA: 401 Unauthorized
    
    Note over SPA: Axios Interceptor intercepts 401
    
    SPA->>API: POST /auth/refresh (Sends RefreshToken)
    API->>DB: Verify RefreshToken hash
    DB-->>API: Match
    API->>DB: Invalidate old RefreshToken hash
    API->>API: Generate NEW AccessToken & NEW RefreshToken
    API->>DB: Store NEW RefreshToken hash
    API-->>SPA: Return new token pair
    
    Note over SPA: Axios Interceptor retries original request
    
    SPA->>API: GET /api/v1/contracts (New AccessToken)
    API-->>SPA: 200 OK (Data returned)
```

## 6. UML Use Case Diagram (Role-Based Access Control)
**Where to use:** Chapter 4 (Access Control & Authorisation).
**Why you need it:** Proves the application enforces strict boundaries between different user personas as mandated by the Peffers DSR objectives for security.

```mermaid
usecaseDiagram
    actor Admin
    actor Analyst
    actor Editor

    package "DORA SaaS Platform" {
        usecase "Manage Tenants & Users" as UC1
        usecase "Export CBI Validation package" as UC2
        usecase "View Concentration Risk Dashboard" as UC3
        
        usecase "Execute Validation Run" as UC4
        usecase "Flag Compliance Issues" as UC5
        usecase "Approve/Reject Fixes" as UC6
        usecase "Manage ICT Supply Chain" as UC7
        
        usecase "Manage Contracts & ICT Providers" as UC8
        usecase "Resolve Compliance Issues" as UC9
    }

    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    
    Analyst --> UC4
    Analyst --> UC5
    Analyst --> UC6
    Analyst --> UC7
    
    Editor --> UC8
    Editor --> UC9
    
    %% Note: Admin inherently has read access to everything, but this maps write/execution duties.
```

## 7. UML Class Diagram (Core Domain Model)
**Where to use:** Chapter 4 (Database Architecture).
**Why you need it:** An object-oriented perspective of your relational database. Essential for examiners to map the DORA regulatory articles (contracts, providers, functions) to your system entity objects (Classes).

```mermaid
classDiagram
    class Tenant {
        +UUID id
        +String name
        +String lei
        +String country
    }
    
    class FinancialEntity {
        +UUID id
        +String lei
        +String entityType
        +Float totalAssets
    }

    class ContractualArrangement {
        +UUID id
        +String contractReference
        +Date startDate
        +Date endDate
        +Float annualCost
    }

    class IctProvider {
        +UUID id
        +String legalName
        +String providerCode
        +String naceCode
    }

    class BusinessFunction {
        +UUID id
        +String functionIdentifier
        +String functionName
        +Int rto
        +Int rpo
    }

    class ValidationRule {
        +UUID id
        +String templateName
        +String ruleType
        +String severity
        +String errorMessage
    }

    class ValidationIssue {
        +UUID id
        +String status
        +String analystMessage
        +UUID recordId
    }

    Tenant "1" *-- "many" FinancialEntity : Owns
    Tenant "1" *-- "many" IctProvider : Owns
    FinancialEntity "1" --> "many" ContractualArrangement : Is Party To
    IctProvider "1" --> "many" ContractualArrangement : Provides Service For
    ContractualArrangement "many" -- "many" BusinessFunction : Supports (ICT Dependencies)
    ValidationRule "1" --> "many" ValidationIssue : Triggers
```

## 8. UML Activity Diagram (RoI Export Pre-Flight Gate)
**Where to use:** Chapter 5 (Implementation / Evaluation).
**Why you need it:** Visually proves that your system programmatically blocks non-compliant Excel/XBRL generation based on live validation logic.

```mermaid
stateDiagram-v2
    direction TB
    
    state "User Clicks 'Export CBI Package'" as Start
    state "Fetch Latest ValidationRun" as FetchRun
    
    state if_run <<choice>>
    state "Throw 400 BadRequest (No Runs Found)" as FailNoRun
    
    state "Count ERRORs NOT IN (FIXED, RESOLVED, WAITING)" as CountErrors
    
    state if_errors <<choice>>
    state "Throw 400 BadRequest (Blocking Errors)" as FailErrors
    
    state "Zip OIM-CSV Files" as ZipFiles
    state "Return 200 OK (Download)" as Success
    
    Start --> FetchRun
    FetchRun --> if_run
    
    if_run --> FailNoRun : Run == NULL
    if_run --> CountErrors : Run Exists
    
    CountErrors --> if_errors
    
    if_errors --> FailErrors : ERROR Count > 0
    if_errors --> ZipFiles : ERROR Count == 0
    
    ZipFiles --> Success
```

---

## Omitted UML Diagrams (And How to Defend Them)

If an examiner or reviewer asks why certain traditional UML diagrams are not present in your thesis, you should explicitly state the following rationale in your Methodology or Limitations chapter:

1. **UML Deployment Diagram**: 
   * **Why it is omitted**: The current artefact is explicitly framed as a mathematically complete *proof-of-concept prototype* running via local `docker-compose`. 
   * **Defense**: "A formal Deployment Diagram mapping cloud topology, load balancers, and highly available multi-AZ Postgres replicas was deemed out-of-scope for the Design Science Research cycle. The primary research objective was validating the rule-engine architecture and data modeling, not cloud orchestration."
2. **UML Object Diagram**: 
   * **Why it is omitted**: Object diagrams represent instances of classes at specific moments in time. 
   * **Defense**: "Given the massive scale of the seeded database (hundreds of mock entities, providers, and contracts), modeling instance-level discrete objects provided no additional academic value over the structural Class Diagram."
