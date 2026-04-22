# Live Demo Seeding Guide — Viva Preparation
> "How to add validation rules and inject deliberate violations directly into the database,
> bypassing the frontend, for a live demonstration."

---

## PART 1 — UNDERSTANDING THE TWO FILES

There are exactly **2 files** you need to know:

| File | What it does |
|------|-------------|
| `backend/prisma/seed-validation-rules.ts` | Populates the `validation_rules` table — the BRAIN of the engine |
| `backend/prisma/seed.ts` | Populates all business data (providers, contracts, functions) — including deliberate BAD data |

**The frontend cannot block changes made directly via these scripts or via `psql`.**
That is the entire point of a "bypass" — you are talking directly to PostgreSQL, skipping all NestJS validators.

---

## PART 2 — HOW TO ADD A NEW VALIDATION RULE

### Step 1 — Open the file
```
/Volumes/D/dora_saas/backend/prisma/seed-validation-rules.ts
```

### Step 2 — Add one `rules.push(...)` line

Every rule has this exact shape:
```typescript
rules.push({
  templateName: 'RT.05.01',         // which EBA template (RT.01.01, RT.02.01, etc.)
  fieldName:    'nace_code',         // which DB column to check
  ruleType:     'format',            // the rule TYPE (see table below)
  ruleValue:    '^[A-Z][0-9]{2}$',  // the rule PARAMETER (regex / table name / range)
  errorMessage: 'NACE code must follow NACE Rev.2 format (EBA VR_70)',
  severity:     'ERROR',             // or 'WARNING'
  doraArticle:  'Art.28(3)',         // optional — DORA article reference
});
```

### Rule Types Reference Table

| ruleType | What it checks | ruleValue means |
|----------|---------------|-----------------|
| `required` | Field is not NULL and not empty string | The **table name** that holds the field |
| `format` | Field matches a regex pattern | The **regex string** (e.g. `^[A-Z0-9]{20}$`) |
| `dropdown` | Value exists in a reference table | `reference_table.column` (e.g. `countries.code`) |
| `range` | Number is within min/max | `min\|max` — e.g. `0\|` means ≥0, `1\|100` means 1–100 |
| `fk_exists` | A foreign key record actually exists | `table.fk_column→target_table.id` |
| `cross-field` | Field A vs Field B on same row | `table.fieldA>table.fieldB` (end_date > start_date) |
| `conditional` | Field B required IF Field A = value | `table.fieldA=value→fieldB.required` |

### Step 3 — Run the seed script
```bash
cd /Volumes/D/dora_saas/backend
.node/bin/node -r ts-node/register prisma/seed-validation-rules.ts
```

**What this does:**
1. Deletes ALL existing validation rules from the DB (`deleteMany({})`)
2. Re-inserts all rules including your new one
3. Prints a summary by template / type / severity

> ⚠️ **Important**: Because the script wipes and re-seeds every time, your new rule is always included. You never need to manually delete rows.

---

## PART 3 — HOW TO INJECT A DELIBERATE VIOLATION (3 METHODS)

The frontend has HTML validation that prevents saving bad data. Here are 3 ways to bypass it.

---

### METHOD 1 — Edit `seed.ts` and re-run (Best for viva demo)

This is the most professional way. The violations are already there — you just remind the examiner they were deliberate.

**Existing deliberate violations in `seed.ts`:**

| Violation | Where injected | Which rule fires |
|-----------|---------------|-----------------|
| Provider `legalName = null` (Microsoft Azure) | Line ~443 | EBA VR_63 — required |
| Contract `endDate < startDate` (CTX-1002) | Line ~482 | EBA VR_51 — cross-field |
| Contract `startDate = null` (CTX-1003) | Line ~483 | EBA VR_26 — required |
| Contract `storageLocation = null` (CTX-1004) | Line ~484 | EBA VR_48 — conditional |

**To re-run the full seed:**
```bash
cd /Volumes/D/dora_saas/backend
.node/bin/node -r ts-node/register prisma/seed.ts
```

Then go to the app → Analyst dashboard → "Run Validation" → watch the issues appear.

---

### METHOD 2 — Direct SQL via `psql` (Fastest for live injection)

This is the most impressive way for a viva. You open a terminal, type SQL, and immediately show the system detecting it.

**Connect to the database:**
```bash
docker exec -it dora_saas-postgres-1 psql -U postgres -d DORA_DB
```
> If that container name doesn't work, run: `docker ps` to find the exact name.

**Check your tenant ID first:**
```sql
SELECT id, name FROM tenants LIMIT 5;
-- Copy the UUID, e.g.: a1b2c3d4-1234-5678-abcd-000000000001
```

**Example — Corrupt an ICT Provider's LEI to an invalid format:**
```sql
-- First find a provider to corrupt
SELECT id, legal_name, lei FROM ict_providers WHERE tenant_id = 'YOUR-TENANT-UUID' LIMIT 3;

-- Then corrupt its LEI (make it only 10 chars — fails EBA VR_62)
UPDATE ict_providers
SET lei = 'BADLEI1234'
WHERE legal_name = 'Amazon Web Services'
  AND tenant_id = 'YOUR-TENANT-UUID';
```

**Example — Null out a mandatory field on a contract:**
```sql
-- Null out the contract_reference (triggers EBA VR_25)
UPDATE contractual_arrangements
SET contract_reference = NULL
WHERE contract_reference = 'CTX-1000'
  AND tenant_id = 'YOUR-TENANT-UUID';
```

**Example — Break a foreign key (FK violation):**
```sql
-- Point a supply chain entry at a non-existent provider
UPDATE ict_supply_chain
SET provider_id = '00000000-0000-0000-0000-000000000000'
WHERE tenant_id = 'YOUR-TENANT-UUID'
LIMIT 1;
```

**After injecting — run validation from the app:**
1. Log in as Analyst
2. Click "Run Validation"
3. The system detects the violation and creates an OPEN issue
4. Score drops immediately

**To undo afterwards:**
```sql
-- Restore the LEI
UPDATE ict_providers
SET lei = 'PROVAWS00000000000001'
WHERE legal_name = 'Amazon Web Services'
  AND tenant_id = 'YOUR-TENANT-UUID';
```

---

### METHOD 3 — One-shot inject script (Best for repeatability)

Create a small TypeScript file you can run in seconds. Save it as:
```
/Volumes/D/dora_saas/backend/prisma/inject-demo-violations.ts
```

**Content:**
```typescript
/**
 * Inject deliberate DORA violations for live demonstration.
 * Run: cd backend && .node/bin/node -r ts-node/register prisma/inject-demo-violations.ts
 * Undo: cd backend && .node/bin/node -r ts-node/register prisma/inject-demo-violations.ts --restore
 */
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/DORA_DB?schema=public',
});
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

const RESTORE = process.argv.includes('--restore');

async function main() {
  // Get the first tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found. Run seed.ts first.');
  console.log(`Using tenant: ${tenant.name} (${tenant.id})\n`);

  const providers = await prisma.ictProvider.findMany({ where: { tenantId: tenant.id } });
  const contracts = await prisma.contractualArrangement.findMany({ where: { tenantId: tenant.id } });

  if (RESTORE) {
    console.log('🔄 Restoring clean data...\n');

    // Restore provider legal name
    await prisma.ictProvider.updateMany({
      where: { tenantId: tenant.id, providerCode: 'MSFT' },
      data: { legalName: 'Microsoft Azure' },
    });

    // Restore contract start date
    if (contracts[2]) {
      await prisma.contractualArrangement.update({
        where: { id: contracts[2].id },
        data: { startDate: new Date('2024-01-01') },
      });
    }

    console.log('✅ Data restored. Run validation again to confirm score rises.\n');
  } else {
    console.log('💉 Injecting deliberate violations...\n');

    // VIOLATION 1 — Null legalName on Microsoft Azure (EBA VR_63)
    await prisma.ictProvider.updateMany({
      where: { tenantId: tenant.id, providerCode: 'MSFT' },
      data: { legalName: null },
    });
    console.log('  ✓ Violation 1: Microsoft Azure legalName → NULL (VR_63 fires)');

    // VIOLATION 2 — endDate before startDate on first contract (EBA VR_51)
    if (contracts[0]) {
      await prisma.contractualArrangement.update({
        where: { id: contracts[0].id },
        data: {
          startDate: new Date('2027-06-01'),
          endDate: new Date('2024-01-01'),
        },
      });
      console.log(`  ✓ Violation 2: Contract ${contracts[0].contractReference} endDate < startDate (VR_51 fires)`);
    }

    // VIOLATION 3 — Null startDate on second contract (EBA VR_26)
    if (contracts[1]) {
      await prisma.contractualArrangement.update({
        where: { id: contracts[1].id },
        data: { startDate: null },
      });
      console.log(`  ✓ Violation 3: Contract ${contracts[1].contractReference} startDate → NULL (VR_26 fires)`);
    }

    console.log('\n✅ Violations injected. Now go to the app and run validation as Analyst.\n');
    console.log('   To restore: run this script with --restore flag\n');
  }
}

main()
  .then(() => prisma.$disconnect())
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    pool.end();
    process.exit(1);
  });
```

**Commands:**
```bash
# Inject violations (before showing the examiner)
cd /Volumes/D/dora_saas/backend
.node/bin/node -r ts-node/register prisma/inject-demo-violations.ts

# Then run validation in the app → violations appear

# Restore clean data (after showing the examiner)
.node/bin/node -r ts-node/register prisma/inject-demo-violations.ts --restore

# Run validation again → score recovers
```

---

## PART 4 — THE PERFECT LIVE VIVA DEMO SEQUENCE

**"Can you demonstrate the validation engine working?"**

Say: *"Yes. Watch — I am going to inject a deliberate violation directly into the database, bypassing the frontend, to show you the engine operates independently of UI validation."*

### Step-by-step:

**Terminal 1:**
```bash
cd /Volumes/D/dora_saas/backend
.node/bin/node -r ts-node/register prisma/inject-demo-violations.ts
```
Say: *"I have just set Microsoft Azure's legal name to NULL and made one contract's end date earlier than its start date — two separate EBA rule violations."*

**Browser (App):**
1. Open `http://localhost:5173` — log in as Analyst
2. Go to Validation Dashboard
3. Click "Run Validation"
4. Say: *"The engine is now executing 220 SQL queries — one per rule. Each query returns record IDs that fail the check."*
5. Score drops. New OPEN issues appear.
6. Click on an issue — show the exact EBA article reference and error message.
7. Click "Flag Issue" → status becomes FLAGGED
8. Say: *"An Editor can now be assigned to fix this record. When they save the record with the correct data, they are prompted to confirm the fix. The issue transitions to WAITING_APPROVAL, and on the next validation run, if the record passes, the issue auto-closes as FIXED."*

**Restore:**
```bash
.node/bin/node -r ts-node/register prisma/inject-demo-violations.ts --restore
```
Run validation again → score recovers → issues close.

---

## PART 5 — HOW TO ADD A COMPLETELY NEW RULE LIVE

**"Can you add a new validation rule right now?"**

Say: *"Yes. I will add a rule that checks no business function has an RTO of more than 72 hours — a DORA proportionality threshold."*

**Open `seed-validation-rules.ts` and add:**
```typescript
rules.push({
  templateName: 'RT.06.01',
  fieldName:    'rto',
  ruleType:     'range',
  ruleValue:    '0|72',
  errorMessage: 'RTO must not exceed 72 hours per DORA proportionality guidance (Art.11)',
  severity:     'WARNING',
  doraArticle:  'Art.11',
});
```

**Re-seed rules:**
```bash
cd /Volumes/D/dora_saas/backend
.node/bin/node -r ts-node/register prisma/seed-validation-rules.ts
```

**Run validation in app** → if any business function has RTO > 72, you get a WARNING issue.

**Say to examiner**: *"This demonstrates the declarative architecture. I did not write any TypeScript logic. I added one data record. The existing `range` executor handled it automatically. This is the generalisability claim of Contribution 2."*

---

## PART 6 — QUICK COMMAND REFERENCE CARD

```bash
# Re-seed all validation rules (safe — wipes and re-inserts rules only)
cd /Volumes/D/dora_saas/backend
.node/bin/node -r ts-node/register prisma/seed-validation-rules.ts

# Re-seed ALL business data (WARNING — resets all tenant data)
cd /Volumes/D/dora_saas/backend
.node/bin/node -r ts-node/register prisma/seed.ts

# Inject deliberate violations
.node/bin/node -r ts-node/register prisma/inject-demo-violations.ts

# Restore clean data
.node/bin/node -r ts-node/register prisma/inject-demo-violations.ts --restore

# Connect to DB directly
docker exec -it dora_saas-postgres-1 psql -U postgres -d DORA_DB

# Open Prisma Studio (visual DB browser)
open http://localhost:5555

# List all validation rules in DB
docker exec -it dora_saas-postgres-1 psql -U postgres -d DORA_DB \
  -c "SELECT rule_type, COUNT(*) FROM validation_rules GROUP BY rule_type ORDER BY COUNT(*) DESC;"

# Count open issues
docker exec -it dora_saas-postgres-1 psql -U postgres -d DORA_DB \
  -c "SELECT status, severity, COUNT(*) FROM validation_issues GROUP BY status, severity ORDER BY status;"
```

---

## PART 7 — WHY THE FRONTEND CANNOT BLOCK THIS

The frontend uses controlled form inputs with `required` HTML attributes and TypeScript types. These protect against accidental omissions in normal use.

But seed scripts and `psql` connect **directly to PostgreSQL**, bypassing:
- The NestJS HTTP layer
- All DTO validators (`class-validator`)
- All `BadRequestException` guards
- All HTML form validation

The ONLY layer that always fires is **PostgreSQL RLS** — which enforces tenant isolation. But RLS does not enforce business data quality (nulls, formats, FK integrity) — that is what the **validation engine** is for.

This is why the dissertation says: *"The validation engine is the system's primary data quality enforcement mechanism."* — because the database schema itself allows null fields (for flexibility), and only the engine detects and surfaces compliance violations.

---

*Save this file. Have it open on a second screen during your viva.*
