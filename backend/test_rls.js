const { execSync } = require('child_process');

const direct_tables = [
  'financial_entities', 'branches', 'ict_providers', 'ict_services',
  'contractual_arrangements', 'business_functions', 'ict_service_assessments',
  'exit_strategies', 'validation_runs', 'validation_issues', 'notifications',
  'audit_logs', 'users', 'comments'
];

for (const tbl of direct_tables) {
  const sql = `ALTER TABLE ${tbl} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${tbl} FORCE ROW LEVEL SECURITY; DROP POLICY IF EXISTS tenant_isolation ON ${tbl}; CREATE POLICY tenant_isolation ON ${tbl} USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);`;
  try {
    execSync(`npx prisma db execute --stdin`, { input: sql });
    console.log(`OK: ${tbl}`);
  } catch (e) {
    console.error(`FAILED: ${tbl} - ${e.message}`);
  }
}
