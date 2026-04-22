-- ============================================================
-- DORA SaaS — PostgreSQL Row-Level Security Policies
-- Applied: 18 April 2026
-- ============================================================
-- Strategy:
--   1. Tables WITH tenant_id: direct equality policy.
--   2. Junction tables WITHOUT tenant_id: EXISTS subquery
--      through a parent table that has tenant_id.
--   3. Reference/lookup tables (countries, currencies, etc.):
--      NO RLS — shared across all tenants by design.
--   4. current_setting('app.current_tenant_id', true) returns
--      NULL if the session variable is not set.
--      NULL comparison always fails, so unset = no rows visible.
--      NestJS TenantIsolationMiddleware sets this variable for
--      every authenticated request.
-- ============================================================

-- ── Tables with direct tenant_id column ─────────────────────

DO $$
DECLARE tbl TEXT;
DECLARE direct_tables TEXT[] := ARRAY[
  'financial_entities',
  'branches',
  'ict_providers',
  'ict_services',
  'contractual_arrangements',
  'business_functions',
  'ict_service_assessments',
  'exit_strategies',
  'ict_supply_chain',
  'validation_runs',
  'validation_issues',
  'notifications',
  'audit_logs',
  'users',
  'comments'
];
BEGIN
  FOREACH tbl IN ARRAY direct_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format($pol$
      CREATE POLICY tenant_isolation ON %I
        USING (
          tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
    $pol$, tbl);
    RAISE NOTICE 'RLS (direct) enabled on: %', tbl;
  END LOOP;
END $$;

-- ── Junction tables — RLS via parent ─────────────────────────

-- contract_entities: isolation via contractual_arrangements
ALTER TABLE contract_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_entities FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON contract_entities;
CREATE POLICY tenant_isolation ON contract_entities
  USING (
    EXISTS (
      SELECT 1 FROM contractual_arrangements ca
      WHERE ca.id = contract_entities.contract_id
        AND ca.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
  );

-- contract_providers: isolation via contractual_arrangements
ALTER TABLE contract_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_providers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON contract_providers;
CREATE POLICY tenant_isolation ON contract_providers
  USING (
    EXISTS (
      SELECT 1 FROM contractual_arrangements ca
      WHERE ca.id = contract_providers.contract_id
        AND ca.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
  );

-- entities_using_services: isolation via contractual_arrangements
ALTER TABLE entities_using_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities_using_services FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON entities_using_services;
CREATE POLICY tenant_isolation ON entities_using_services
  USING (
    EXISTS (
      SELECT 1 FROM contractual_arrangements ca
      WHERE ca.id = entities_using_services.contract_id
        AND ca.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
  );

-- function_ict_dependencies: isolation via business_functions
ALTER TABLE function_ict_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE function_ict_dependencies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON function_ict_dependencies;
CREATE POLICY tenant_isolation ON function_ict_dependencies
  USING (
    EXISTS (
      SELECT 1 FROM business_functions bf
      WHERE bf.id = function_ict_dependencies.function_id
        AND bf.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
  );

-- exit_strategy_services: isolation via exit_strategies
ALTER TABLE exit_strategy_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE exit_strategy_services FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON exit_strategy_services;
CREATE POLICY tenant_isolation ON exit_strategy_services
  USING (
    EXISTS (
      SELECT 1 FROM exit_strategies es
      WHERE es.id = exit_strategy_services.exit_strategy_id
        AND es.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
  );

-- ── Superuser bypass (postgres role used by seed/migrations) ─
-- PostgreSQL superusers bypass RLS automatically.
-- No additional grant needed for the postgres role.

SELECT 'RLS policies applied successfully' AS result;
