const { execSync } = require('child_process');

const queries = [
`ALTER TABLE contract_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_entities FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON contract_entities;
CREATE POLICY tenant_isolation ON contract_entities USING (EXISTS (SELECT 1 FROM contractual_arrangements ca WHERE ca.id = contract_entities.contract_id AND ca.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));`,

`ALTER TABLE contract_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_providers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON contract_providers;
CREATE POLICY tenant_isolation ON contract_providers USING (EXISTS (SELECT 1 FROM contractual_arrangements ca WHERE ca.id = contract_providers.contract_id AND ca.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));`,

`ALTER TABLE entities_using_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities_using_services FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON entities_using_services;
CREATE POLICY tenant_isolation ON entities_using_services USING (EXISTS (SELECT 1 FROM contractual_arrangements ca WHERE ca.id = entities_using_services.contract_id AND ca.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));`,

`ALTER TABLE function_ict_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE function_ict_dependencies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON function_ict_dependencies;
CREATE POLICY tenant_isolation ON function_ict_dependencies USING (EXISTS (SELECT 1 FROM business_functions bf WHERE bf.id = function_ict_dependencies.function_id AND bf.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));`,

`ALTER TABLE exit_strategy_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE exit_strategy_services FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON exit_strategy_services;
CREATE POLICY tenant_isolation ON exit_strategy_services USING (EXISTS (SELECT 1 FROM exit_strategies es WHERE es.id = exit_strategy_services.exit_strategy_id AND es.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));`,

`ALTER TABLE ict_supply_chain ENABLE ROW LEVEL SECURITY;
ALTER TABLE ict_supply_chain FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON ict_supply_chain;
CREATE POLICY tenant_isolation ON ict_supply_chain USING (EXISTS (SELECT 1 FROM contractual_arrangements ca WHERE ca.id = ict_supply_chain.contract_id AND ca.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));`
];

for (const q of queries) {
  try {
    execSync(`npx prisma db execute --stdin`, { input: q });
    console.log(`OK`);
  } catch (e) {
    console.error(`FAILED: ${e.message}`);
  }
}
