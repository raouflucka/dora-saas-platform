/**
 * inject-demo-violations.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Inject or restore deliberate DORA compliance violations for a live
 * viva / demo demonstration — bypasses the frontend entirely.
 *
 * Uses raw pg (not Prisma) as SUPERUSER — no RLS applies.
 *
 * INJECT (default):
 *   cd backend && .node/bin/node -r ts-node/register prisma/inject-demo-violations.ts
 *
 * RESTORE to clean state:
 *   cd backend && .node/bin/node -r ts-node/register prisma/inject-demo-violations.ts --restore
 *
 * ── Violations injected ─────────────────────────────────────────────────
 *   #1 — ICT Provider "MSFT" (Microsoft Azure) → legal_name = NULL
 *         Rule: EBA VR_63  →  required  →  ict_providers
 *               DORA Art.28(1)
 *
 *   #2 — Contract CTX-1000 → end_date BEFORE start_date
 *         Rule: EBA VR_51  →  cross-field  →  contractual_arrangements
 *               DORA Art.30
 *
 *   #3 — Contract CTX-1001 → start_date = NULL
 *         Rule: EBA VR_26  →  required  →  contractual_arrangements
 *               DORA Art.30
 * ─────────────────────────────────────────────────────────────────────────
 */

import { Pool } from 'pg';

const RESTORE = process.argv.includes('--restore');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:1234@localhost:5432/DORA_DB',
});

async function main() {
  const client = await pool.connect();

  try {
    const tenantRes = await client.query('SELECT id, name FROM tenants LIMIT 1');
    if (!tenantRes.rowCount) throw new Error('No tenant found. Run seed.ts first.');
    const { id: tenantId, name: tenantName } = tenantRes.rows[0];
    console.log(`\n🏢  Tenant : ${tenantName}  (${tenantId})\n`);

    if (RESTORE) {
      // ── RESTORE ───────────────────────────────────────────────
      console.log('🔄  Restoring clean data...\n');

      const r1 = await client.query(
        `UPDATE ict_providers
         SET legal_name = 'Microsoft Azure'
         WHERE provider_code = 'MSFT'`
      );
      console.log(`  ✓ ICT Provider MSFT legal_name restored  (${r1.rowCount} row)`);

      const r2 = await client.query(
        `UPDATE contractual_arrangements
         SET start_date = '2024-01-01', end_date = '2026-12-31'
         WHERE contract_reference = 'CTX-1000'`
      );
      console.log(`  ✓ Contract CTX-1000 dates restored  (${r2.rowCount} row)`);

      const r3 = await client.query(
        `UPDATE contractual_arrangements
         SET start_date = '2024-01-01'
         WHERE contract_reference = 'CTX-1001'`
      );
      console.log(`  ✓ Contract CTX-1001 startDate restored  (${r3.rowCount} row)`);

      console.log('\n✅  All data restored.\n');
      console.log('   → Go to the app → Run Validation → score should recover.\n');

    } else {
      // ── INJECT ────────────────────────────────────────────────
      console.log('💉  Injecting deliberate DORA violations...\n');

      // VIOLATION 1 — legalName = NULL on MSFT provider
      const v1 = await client.query(
        `UPDATE ict_providers
         SET legal_name = NULL
         WHERE provider_code = 'MSFT'`
      );
      console.log(`  ✓ Violation 1 — ICT Provider "MSFT" legal_name → NULL`);
      console.log(`    Rule: EBA VR_63 (required)  |  DORA Art.28(1)`);
      console.log(`    Rows affected: ${v1.rowCount}\n`);

      // VIOLATION 2 — endDate BEFORE startDate on CTX-1000
      const v2 = await client.query(
        `UPDATE contractual_arrangements
         SET start_date = '2027-06-01', end_date = '2024-01-01'
         WHERE contract_reference = 'CTX-1000'`
      );
      console.log(`  ✓ Violation 2 — Contract CTX-1000: endDate < startDate`);
      console.log(`    Rule: EBA VR_51 (cross-field)  |  DORA Art.30`);
      console.log(`    startDate → 2027-06-01  |  endDate → 2024-01-01`);
      console.log(`    Rows affected: ${v2.rowCount}\n`);

      // VIOLATION 3 — startDate = NULL on CTX-1001
      const v3 = await client.query(
        `UPDATE contractual_arrangements
         SET start_date = NULL
         WHERE contract_reference = 'CTX-1001'`
      );
      console.log(`  ✓ Violation 3 — Contract CTX-1001: startDate → NULL`);
      console.log(`    Rule: EBA VR_26 (required)  |  DORA Art.30`);
      console.log(`    Rows affected: ${v3.rowCount}\n`);

      console.log('─'.repeat(60));
      console.log('✅  Violations injected. Now demonstrate in the app:\n');
      console.log('  1. Open http://localhost:5173 → login as Analyst');
      console.log('  2. Go to Validation Dashboard → "Run Validation"');
      console.log('  3. Watch 3 OPEN issues appear with EBA VR codes');
      console.log('  4. Click any issue → see DORA article reference\n');
      console.log('  To restore:');
      console.log('  .node/bin/node -r ts-node/register prisma/inject-demo-violations.ts --restore\n');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  pool.end();
  process.exit(1);
});
