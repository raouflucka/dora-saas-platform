# Technology Justification: Prisma ORM

This document provides a comprehensive academic justification for using **Prisma ORM** as the core data mapping and management layer for the DORA SaaS platform. It is designed to be used in **Chapter 4 (Architecture)** or **Chapter 5 (Implementation)** of your dissertation.

---

## 0. Beginner Context: What is Prisma, and why not use Raw PostgreSQL directly?

To understand Prisma, it is helpful to understand the core problem it solves: **The Language Barrier.**

Your database (**PostgreSQL**) is a storage engine. It only understands one language: **SQL** (Structured Query Language). To get data out of it, you must send it a string of text like: `SELECT * FROM contractual_arrangements WHERE tenant_id = '123'`.

Your application (**NestJS/TypeScript**) is where your logic lives. It thinks in terms of Object-Oriented Programming (Classes, Objects, Arrays, and Types). 

**The Old Way (Without Prisma)**  
If we did not use Prisma, every time we wanted to fetch a contract, we would have to hand-write raw SQL text strings directly inside our TypeScript code. 
* *The problem?* It is extremely dangerous and error-prone. If you accidentally type `SELECT * FROM contract_arangement` (missing an 'r'), TypeScript will not warn you. Your app will just crash at runtime when PostgreSQL rejects the badly-spelled string. Also, managing relationships (fetching a contract AND all of its linked suppliers) requires writing massive, messy `JOIN` queries.

**The New Way (With Prisma as the Middle Layer)**  
Prisma is an **ORM** (Object-Relational Mapper). It acts as an automatic translator between TypeScript and PostgreSQL.
* Instead of writing SQL strings, you write TypeScript functions: `prisma.contractualArrangement.findMany(...)`.
* Prisma automatically generates the complex, secure SQL query in the background and sends it to PostgreSQL for you.
* *The magic?* Because Prisma reads your database structure, it gives you **TypeScript autocomplete**. If you try to ask for a column that doesn't exist, your code editor will throw a red error *before* you even run the app. It saves hundreds of hours of debugging and prevents severe security flaws like SQL Injection.

Think of PostgreSQL as the secure vault where the data lives, and Prisma as the highly intelligent librarian who safely fetches, organizes, and formats the data for your application.

---

## 1. Why Prisma Was the "Perfect Choice" (Selection Basis)

In a Design Science Research (DSR) project tackling complex regulatory data models (DORA/EBA), the choice of Object-Relational Mapper (ORM) is critical. Prisma was selected over alternatives like TypeORM, Sequelize, or raw SQL based on four deliberate architectural criteria:

1. **Schema as a Single Source of Truth**: The declarative `schema.prisma` file acts as the ultimate blueprint. Instead of scattering database logic across dozens of `@Entity` classes (like TypeORM), Prisma centralized the entire 30+ table DORA data model into one highly readable, human-verifiable file. This proved invaluable for mapping EBA RT templates to database columns.
2. **Absolute End-to-End Type Safety**: Prisma auto-generates strict TypeScript definitions mathematically derived from the database schema. When accessing a `ContractualArrangement` in NestJS, the compiler guarantees that nested relational properties (`ictDependencies`, `entities`) are perfectly typed, eliminating an entire class of runtime `undefined` errors.
3. **Handling Complex Networked Relationships**: The DORA data model is characterized by many-to-many relationships (e.g., a single contract supporting multiple critical business functions) and self-referencing hierarchies (N-tier subcontracting supply chains). Prisma's fluent API (`include`, `select`, `connect`) handles these joins effortlessly.
4. **Rapid Iteration for DSR Prototyping**: Through the `prisma db push` command, the platform schema could be mutated and synchronized instantly during the exploratory phases of the design cycle, avoiding the friction of managing static migration files before the schema stabilized.

---

## 2. What Exactly Prisma Was Used For

Throughout the artefact lifecycle, Prisma served three distinct foundational roles:

1. **Domain Modeling (The Blueprint)**: Defining the physical database constraints, Foreign Keys, unique indices, and enumerations (e.g., Criticality Levels, Role definitions).
2. **The Query Execution Layer**: Bridging the NestJS backend controllers with PostgreSQL. Every CRUD operation (Create, Read, Update, Delete) performed by the Admin, Analyst, or Editor triggered a type-safe Prisma query.
3. **The Simulation Engine (Seeding)**: The execution of the massive `seed.ts` file. Prisma was used to systematically wipe the database and inject 220 algorithmic EBA Validation Rules alongside hundreds of synthetic mock records (Financial Entities, Contracts, Supply Chain nodes) to facilitate system demonstration.

---

## 3. Four Concrete Examples of Prisma Implementation

To prove technical competence in your thesis, you can cite these four distinct ways Prisma was leveraged in the codebase, demonstrating both standard ORM usage and advanced escape hatches.

### Example 1: Deep Relational Querying (Data Fetching)
Instead of writing complex SQL `JOIN` statements to fetch a contract and all of its associated supply chain details, Prisma's `include` syntax was used. This is extensively utilized in the **RoI Export Module** to pull all necessary data for the XBRL package simultaneously.

```typescript
// Fetching a contract and unpacking its deeply-nested relationships
const contract = await this.prisma.contractualArrangement.findUnique({
  where: { id: contractId, tenantId: user.tenantId },
  include: {
    financialEntity: true,
    ictProvider: true,
    ictDependencies: {
      include: { businessFunction: true } // Joins Art. 28(4) mappings
    },
    supplyChainNodes: true // Joins Art. 28(3) mappings
  }
});
```

### Example 2: Type-Safe Relational Inserts (Mutations)
When an Analyst links a Business Function to an ICT Contract, Prisma uses the `connect` syntax instead of manually resolving Foreign Key constraints. This ensures referential integrity right out of the box.

```typescript
// FunctionIctDependencies junction creation
await this.prisma.functionIctDependency.create({
  data: {
    businessFunction: { connect: { id: functionId } },
    contract: { connect: { id: contractId } }
  }
});
```

### Example 3: The "Escape Hatch" for the Declarative Engine
While Prisma is typed, the **Validation Engine** needed to dynamically generate SQL queries on the fly based on rules stored as data (the 220 EBA rules). Prisma provided the `$queryRawUnsafe` escape hatch, allowing the engine to bridge the ORM paradigm with mathematical raw execution.

```typescript
// ValidationService.ts dynamically finding missing required fields
const failingRecords = await this.prisma.$queryRawUnsafe(
  `SELECT id FROM ${tableName} 
   WHERE tenant_id = $1 AND (${fieldName} IS NULL OR ${fieldName}::text = '')`,
  tenantId
);
```

### Example 4: Bulk Upserts for Core Config Data (Seeding)
To ensure the system boots with identical baseline reference data (EBA Code Lists, Countries, Validation Rules), Prisma's `upsert` command was used in `seed.ts`. This ensured idempotency—meaning the database could be seeded 100 times without duplicating records.

```typescript
// seed.ts: Injecting the EBA regulations as data
for (const rule of EBA_RULES) {
  await prisma.validationRule.upsert({
    where: { id: rule.id },
    update: rule, // Update if exists
    create: rule  // Create if new
  });
}
```
