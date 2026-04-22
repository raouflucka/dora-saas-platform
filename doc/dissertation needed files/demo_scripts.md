# DORA SaaS — Dissertation Demonstration Scripts

Use these exact step-by-step scripts during your presentation or when recording your project showcase video. They are designed to highlight the enterprise logic behind the application.

---

## DEMO 1: The "Zero-Trust" Multi-Tenant Proof (Security)

**Goal**: Prove that Database-Level Row-Level Security (RLS) is active and physically blocks data leakage, even if an API route is compromised.

1. **Setup**:
   - Log into the app as **Tenant A** (e.g. `admin@dora.ie`).
   - Navigate to **Financial Entities** and copy the UUID of one entity from the URL. Let's call this `ENTITY_A_UUID`.
   - Log out. Log in as **Tenant B** (e.g. `demo2@example.com` or create a new user/tenant via backend).
   - Get Tenant B's JWT Token from the browser Network tab (or LocalStorage).

2. **The Execution (Show terminal / Postman)**:
   Explain: *"I am currently logged in as Tenant B. I am going to attempt an IDOR (Insecure Direct Object Reference) attack by requesting Tenant A's private entity. In a poorly designed application, if I know the ID, I get the data."*

   Run this CURL command live:
   ```bash
   curl -X GET http://localhost:3000/api/v1/financial-entities/ENTITY_A_UUID \
     -H "Authorization: Bearer <TENANT_B_JWT_TOKEN>"
   ```

3. **The Result**: 
   The server will return `404 Not Found` or an empty result `{}`. 
   
4. **The Mic-Drop Explanation**:
   *"Notice it didn't return the data. This isn't just a simple IF statement in my code. When the API received the request, my middleware intercepted the token, extracted Tenant B's ID, and hard-locked the PostgreSQL database connection for that specific millisecond to ONLY allow reads for Tenant B. Even if my code had a vulnerability, the Postgres engine physically refused to return Tenant A's row."*

---

## DEMO 2: The Smart Remediation Interception (Compliance Workflow)

**Goal**: Prove the platform isn't just a database, but a living compliance workflow mirroring real-world analyst routines with strict role segregation.

1. **Setup**: Have an entity or contract seeded with an error (e.g., missing LEI on an ICT Provider). Ensure both an Analyst and an Editor account are ready.
2. **The Analyst (Review & Flag)**:
   - *Input*: Log in as the **Analyst**. Go to the Validation Dashboard and click **Run Validation**.
   - *Workflow*: Point out the red `ERROR` (e.g., *VR_61: Missing LEI on provider*).
   - *Action*: Click "Flag to Editor", type a comment: *"Please find the legal entity identifier and fix this ASAP, it blocks CBI export."*
   - *Output*: The issue state changes to **FLAGGED**.
3. **The Editor (Smart Remediation)**:
   - *Input*: Log in as the **Editor**. Open Notifications—click the alert.
   - *Workflow*: Show how the system **deep-links** them straight to the exact broken text box on the exact record.
   - *Action*: Enter a valid LEI (`12345678901234567890`) and hit **Save**.
   - *The Intercept*: The UI intercepts the save and presents the smart modal: **"Is this issue fixed?"** Click **Yes, Submit for Review**.
   - *Output*: The UI automatically updates the issue to **WAITING_APPROVAL**.
4. **The Analyst (Approval & Export)**:
   - *Input*: Log back in as **Analyst**.
   - *Workflow*: Show the dashboard displaying the "Waiting Approval" item. Click "Review".
   - *Action*: Show the UI displaying the old vs. new value. Click **Approve Fix**. The issue becomes **RESOLVED**.
   - *Output*: Log in as Admin. Show the Validation score is now 100%. Click **Export CBI Submission**. Unzip the download, open the CSV in Excel, and show the clean, error-free EBA-mandated format.

---

## DEMO 3: The Declarative Validation Engine (Zero-Code Extensibility)

**Goal**: Prove that the platform's compliance logic is mathematically derived from parameterized data (Rules-as-Data), not hardcoded `IF/ELSE` statements. This architectural choice allows non-developers to update regulatory rules instantly without rebuilding the codebase.

### Part A: How the Engine Works (Architectural Explanation)
Before showing the UI, verbally explain the backend mechanics to the examiners:
*"In a traditional SaaS, if the EBA changes a rule, a developer must rewrite the source code, open a pull request, and deploy a new server. In DORA SaaS, I built a **Declarative SQL Engine**. We literally just insert a rule into a database table. The engine reads the `ruleType` (e.g., 'required', 'format', 'conditional') and dynamically translates it into a high-performance raw SQL query on the fly, enforcing the law instantly."*

### Part B: Scenario 1 — The 'Required' Error (Simple Rule Injection)
1. **The Scenario Setup (Input)**: State: *"Imagine tomorrow the EBA mandates a new rule: Every exit strategy MUST now have a fallback provider."*
2. **The Execution (Workflow)**:
   - Open `npx prisma studio` in your terminal. Go to the `ValidationRules` table.
   - Insert one single row. You do **not** touch the NestJS codebase.
   - `templateName`: *RT.08*
   - `fieldName`: *fallback_provider_id*
   - `ruleType`: *required*
   - `severity`: *ERROR*
   - `errorMessage`: *"EBA Update: Fallback Provider is now mandatory."*
3. **The Proof (Output)**:
   - Switch back to the Analyst dashboard. Click **Run Validation**.
   - Show how the system instantly lights up with new Errors across all your exit strategies. 
   - Explain the mechanic: *"Because the type was 'required', my engine automatically synthesized the query `SELECT id FROM exit_strategies WHERE fallback_provider_id IS NULL` and flagged those records."*

### Part C: Scenario 2 — Complex Logic (The 'Conditional' Error)
1. **The Scenario Setup (Input)**: State: *"DORA has complex dependencies. For example, VR_109 requires that IF a service is marked as NON-substitutable, a text reason MUST be provided. You cannot do this with a basic database constraint."*
2. **The Execution (Workflow)**:
   - Locate VR_109 in the Prisma Studio rule table. 
   - Show the examiners the JSON sitting in the `rule_value` column: `{"when": {"field": "is_substitutable", "equals": "false"}, "require": "substitution_reason"}`.
3. **The Proof (Output)**:
   - Demonstrate it in the UI. Go to ICT Assessments. 
   - Create an assessment marked as `is_substitutable = false` but leave the reason blank.
   - Run validation. 
   - Show the specific error firing.
4. **The Mic-Drop Explanation**:
   *"By storing logic as JSON and mapping it to discrete SQL execution templates, the Validation Engine abstracts away all regulatory complexity. We can support 30 or 300 EBA rules with exactly the same codebase. The system scales mathematically."*

---

## Live Recording Best Practices & Setup Plan

To successfully capture these demonstrations for a dissertation defense or portfolio video, you must prepare the environment to eliminate lag, UI clutter, and hesitation.

### 1. Preparation Checklist (The "Clean Room" Setup)
- **Database Reset**: Run `npm run seed` right before recording to ensure all demo data is fresh, scores are accurate, and your testing artefacts are cleared out.
- **Browser State**: Use a fresh Incognito window or a dedicated browser profile. Hide all bookmarks, extensions, and extraneous tabs.
- **Pre-Login Tabs**: Have three separate browser windows or private-session tabs open simultaneously. Pre-fill the login screens for the `Admin`, `Analyst`, and `Editor` accounts to avoid fumbling with typing passwords on camera.
- **Resolution**: Record in exactly 1080p (1920x1080) or 1440p. High resolution is critical for the text-heavy grids and XBRL Excel exports to be legible.

### 2. Recording the Narration (Input -> Workflow -> Output)
For each module you demonstrate, explicitly narrate the pipeline. Do not just click quietly. Use this vocal structure:
* **State the Input**: *"I am logging in as an Editor. My input here is updating the NACE code for our primary cloud provider."*
* **State the Workflow**: *"As I enter this code, I am not just updating a table; I am triggering our validation interception flow."*
* **State the Output**: *"The output is immediate: the issue state is transitioned, notifications are dispatched, and the Analyst dashboard is updated in real-time."*

### 3. Screen Recording Execution
- **Pacing**: Move your mouse deliberately. Hover over a button for 1 full second before clicking it. Allow the viewer's eyes to track the cursor.
- **Zooming**: When executing the Terminal commands (Demo 1) or showing the XBRL CSV (Demo 2), actively use your system's zoom feature to blow up the text. 
- **Tooling**: Use OBS Studio (Free) or Loom. If using OBS, set up a Hotkey to pause/unpause recording. This allows you to smoothly transition between logging out and logging in as different roles without showing repetitive typing.
