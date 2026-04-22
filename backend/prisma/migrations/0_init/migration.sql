
[+] Added Schemas
  - public

[+] Added tables
  - countries
  - currencies
  - entity_types
  - criticality_levels
  - reliance_levels
  - data_sensitivity_levels
  - ict_service_types
  - provider_person_types
  - user_roles
  - tenants
  - financial_entities
  - branches
  - ict_providers
  - contractual_arrangements
  - contract_entities
  - contract_providers
  - business_functions
  - function_ict_dependencies
  - entities_using_services
  - ict_supply_chain
  - ict_service_assessments
  - users
  - audit_logs
  - validation_rules

[*] Changed the `audit_logs` table
  [+] Added foreign key on columns (tenant_id)
  [+] Added foreign key on columns (user_id)

[*] Changed the `branches` table
  [+] Added foreign key on columns (tenant_id)
  [+] Added foreign key on columns (financial_entity_id)
  [+] Added foreign key on columns (country)

[*] Changed the `business_functions` table
  [+] Added foreign key on columns (tenant_id)
  [+] Added foreign key on columns (financial_entity_id)
  [+] Added foreign key on columns (criticality_level_id)

[*] Changed the `contract_entities` table
  [+] Added foreign key on columns (contract_id)
  [+] Added foreign key on columns (financial_entity_id)

[*] Changed the `contract_providers` table
  [+] Added foreign key on columns (contract_id)
  [+] Added foreign key on columns (provider_id)

[*] Changed the `contractual_arrangements` table
  [+] Added foreign key on columns (tenant_id)
  [+] Added foreign key on columns (financial_entity_id)
  [+] Added foreign key on columns (provider_id)
  [+] Added foreign key on columns (subcontractor_provider_id)
  [+] Added foreign key on columns (ict_service_type_id)
  [+] Added foreign key on columns (reliance_level_id)
  [+] Added foreign key on columns (data_sensitivity_id)
  [+] Added foreign key on columns (governing_law_country)
  [+] Added foreign key on columns (service_country)
  [+] Added foreign key on columns (processing_location)
  [+] Added foreign key on columns (storage_location)

[*] Changed the `entities_using_services` table
  [+] Added foreign key on columns (contract_id)
  [+] Added foreign key on columns (financial_entity_id)
  [+] Added foreign key on columns (branch_id)

[*] Changed the `financial_entities` table
  [+] Added foreign key on columns (tenant_id)
  [+] Added foreign key on columns (entity_type_id)
  [+] Added foreign key on columns (country)
  [+] Added foreign key on columns (currency)
  [+] Added foreign key on columns (parent_entity_id)

[*] Changed the `function_ict_dependencies` table
  [+] Added foreign key on columns (function_id)
  [+] Added foreign key on columns (contract_id)

[*] Changed the `ict_providers` table
  [+] Added foreign key on columns (tenant_id)
  [+] Added foreign key on columns (person_type_id)
  [+] Added foreign key on columns (headquarters_country)
  [+] Added foreign key on columns (currency)
  [+] Added foreign key on columns (parent_provider_id)

[*] Changed the `ict_service_assessments` table
  [+] Added foreign key on columns (contract_id)
  [+] Added foreign key on columns (provider_id)

[*] Changed the `ict_supply_chain` table
  [+] Added foreign key on columns (contract_id)
  [+] Added foreign key on columns (provider_id)
  [+] Added foreign key on columns (subcontractor_provider_id)
  [+] Added foreign key on columns (service_type_id)

[*] Changed the `users` table
  [+] Added unique index on columns (email)
  [+] Added foreign key on columns (tenant_id)
  [+] Added foreign key on columns (role_id)
