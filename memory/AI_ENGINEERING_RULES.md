# AI Engineering Rules

This document defines the required workflow for any AI agent making changes in this repository.

These rules are mandatory for all backend, frontend, data model, API, search, nutrition, and logging changes.

---

## Purpose

This file does **not** define product architecture.  
It defines **how changes must be made safely**.

Use this together with:

- `/memory/ARCHITECTURE.md`

### Difference

- `ARCHITECTURE.md` = what the system should look like
- `AI_ENGINEERING_RULES.md` = how to safely modify the system

---

## Core Rule

Never modify a file in isolation without checking the entire dependency chain first.

Any meaningful code change must be treated as a **system change**, not a local edit.

---

## Required Workflow for Every Significant Change

For any non-trivial feature, refactor, schema change, API change, or calculation change, the AI agent must follow this workflow:

### Step 1 — Repository Scan

Before editing code, scan the repository and identify all potentially impacted layers.

At minimum, inspect:

#### Backend
- routes
- services
- models/schemas
- database access
- cache logic
- auth/security logic

#### Frontend
- API client
- React pages
- shared components
- charts/visualizations
- context/state usage
- utility functions

#### Data
- MongoDB collections
- Pydantic models
- API response contracts
- cached payloads

---

### Step 2 — Dependency Mapping

Before making edits, identify:

- which files import or call the affected code
- which API endpoints are impacted
- which services depend on the change
- which frontend pages/components consume the changed data
- which charts or visualizations use the changed fields
- which collections or indexes are affected

The AI must think through the full dependency graph before implementation.

---

### Step 3 — Impact List

Before writing code, produce an internal checklist of all files likely to require updates.

This includes direct and indirect dependencies.

Examples:
- if a schema changes, update models, routes, frontend usage, charts, and tests
- if an endpoint changes, update API client and all consuming pages
- if nutrition math changes, update all consumers of nutrition outputs

---

### Step 4 — Plan Before Edit

Before changing code, define:

- what will change
- why it will change
- which files must be updated
- what must remain backward compatible
- what might break if not updated everywhere

Do not start by editing random files opportunistically.

---

### Step 5 — Implement Across the Full Stack

When implementing, update all necessary layers consistently.

#### Backend
- schemas/models
- repositories
- services
- routes
- validators
- caching logic if needed

#### Frontend
- API client
- page-level consumers
- reusable components
- chart data adapters
- related utility functions

#### Data/Contracts
- Mongo document shape
- API response shape
- component prop expectations
- derived chart inputs

---

### Step 6 — Repo-Wide Verification Pass

After implementation, search the repository for:

- old field names
- deprecated endpoint paths
- stale imports
- outdated response shape assumptions
- duplicated old logic
- broken references
- mismatched naming conventions

Fix all affected occurrences.

---

### Step 7 — Regression Check

After code changes, verify that related workflows still logically function.

At minimum, check these flows when relevant:

- food search
- autocomplete
- food details
- serving selection
- nutrition calculation
- food logging
- custom foods
- meal builder
- meal library
- barcode lookup
- nutrition score
- keto score
- amino acid chart
- fatty acid chart
- dashboard stats
- trends/stats queries

---

## Mandatory Change Rules

### 1. Never Change One Layer Only

If a field, schema, endpoint, or data shape changes, the AI must update every dependent layer.

Examples:
- backend model only = not enough
- route response only = not enough
- frontend usage only = not enough

All affected layers must be aligned.

---

### 2. Do Not Duplicate Business Logic

If logic already exists in a service, do not recreate it elsewhere.

This is especially important for:

- nutrition calculation
- serving conversion
- scoring logic
- search ranking
- food normalization

If logic is duplicated, consolidate it into the appropriate service layer.

---

### 3. Keep Routes Thin

Routes should:
- validate input
- call services
- return responses

Routes should not become the primary place for:
- calculation logic
- normalization logic
- search ranking logic
- database orchestration
- repeated business rules

If a route is becoming large, extract service/repository logic.

---

### 4. Frontend Must Not Reimplement Backend Rules

Frontend code may display options and render responses.

Frontend code must not become the source of truth for:
- nutrition calculations
- serving conversions
- canonical food normalization
- business-critical scoring logic

If business logic is duplicated in frontend and backend, move the source of truth to backend.

---

### 5. Preserve Contract Stability

Any API change must consider:
- current frontend consumers
- cached payloads
- old route assumptions
- chart inputs
- historical data expectations

Prefer backward-compatible additions over breaking renames.

If a breaking change is unavoidable, update all consumers in the same change.

---

## Special Rules for Nutrition Data

Any change affecting food or nutrition behavior must remain compatible with:

- canonical food schema
- serving schema
- nutrition engine output
- immutable food log schema
- foods routes
- stored foods routes
- frontend food details views
- meal builder
- dashboard summaries
- AminoAcidRadar
- FattyAcidChart
- NutritionScore
- keto score calculations

### Nutrition-Specific Requirements

- per-100g nutrition remains canonical
- serving units remain gram conversions
- nutrition calculation remains centralized
- historical food logs remain immutable snapshots
- search logic stays separate from nutrition logic

---

## Special Rules for Data Model Changes

If changing a model, schema, or Mongo document shape, the AI must check:

- Pydantic models
- repository queries
- route serialization
- frontend assumptions
- log snapshots
- tests/fixtures
- indexes
- seed/population scripts
- caching keys or payloads

No schema change is complete until all affected consumers are updated.

---

## Special Rules for Search Changes

If changing food search, autocomplete, ranking, or popularity logic, the AI must verify:

- search API routes
- search service
- popularity tracking
- local food search behavior
- USDA/OpenFoodFacts fallback behavior
- frontend search result rendering
- result ordering assumptions
- caching behavior

Search ranking logic must remain separate from nutrition calculation logic.

---

## Special Rules for Logging Changes

If changing food logging behavior, the AI must verify:

- nutrition is calculated server-side
- grams are stored explicitly
- nutrition snapshots are stored at log time
- meal type handling remains correct
- stats aggregation still works
- historical logs remain stable

Never redesign logging in a way that makes old logs silently change when food definitions change.

---

## File Size / Complexity Rules

When a file becomes too large or has mixed responsibilities, prefer extraction.

### Heuristics

Strongly consider refactoring if a file:
- exceeds ~400–500 lines
- mixes UI, data fetching, and modal logic
- handles multiple unrelated responsibilities
- contains repeated inline transformation logic

Typical extractions:
- hooks
- service helpers
- presentation components
- repositories
- data adapters

---

## Naming and Consistency Rules

Use consistent naming across layers.

Avoid mixing formats like:
- `fdc_id`
- `fdcId`
- `food_id`

Choose a consistent convention per layer and map explicitly where necessary.

When changing naming:
- update all layers
- do not leave mixed naming unless there is an intentional adapter boundary

---

## Performance Rules

AI agents should consider performance whenever changing hot paths.

### Hot Paths
- search
- autocomplete
- food details
- logging
- daily stats
- trend queries
- nutrition calculations

### Required Checks
- can this query use an index?
- is this response larger than necessary?
- is this logic duplicated repeatedly?
- should this be cached?
- is this work being done in the route instead of a reusable service?

Do not add premature complexity, but do not ignore obvious bottlenecks.

---

## Security Rules

When changing backend code, always check for:

- missing auth requirements
- missing authorization checks
- permissive CORS assumptions
- hardcoded secrets
- unsafe input handling
- missing validation
- unbounded query behavior
- unbounded payload size

Never introduce a new route without considering:
- who can access it
- what data it returns
- whether it should be rate limited

---

## Testing Rules

For meaningful changes, update or add tests where practical.

At minimum, the AI should consider whether the change affects:

- model validation
- service outputs
- API response contracts
- frontend rendering assumptions
- user workflows

If no test is added, the AI should still perform a logical regression pass over affected flows.

---

## Documentation Rules

When significant architecture, schema, or workflow changes are made, update the relevant memory/docs files.

Examples:
- `ARCHITECTURE.md`
- setup docs
- API docs
- seed script docs
- environment/config docs

Documentation should evolve with the system.

---

## Preferred Decision Order

When implementing a change, prefer this order of thinking:

1. architecture/invariants
2. data contracts
3. backend services
4. routes
5. frontend API usage
6. UI rendering
7. caching/performance
8. regression check

This prevents UI-first hacks that break system integrity.

---

## Definition of Done

A change is only complete when:

1. all affected layers are updated
2. old references are removed or migrated
3. data contracts are aligned
4. related flows still work
5. no obvious stale logic remains
6. architecture rules are still respected

Code that "works in one file" is not done.

---

## Short Operational Version

For every important change, the AI must:

1. scan the repo
2. map dependencies
3. update all impacted layers
4. search for stale references
5. verify related workflows
6. preserve architecture invariants

---

## One-Line Instruction for Agents

If the user wants a simple instruction to reference this file, use:

> Follow `/memory/ARCHITECTURE.md` and `/memory/AI_ENGINEERING_RULES.md` before implementing any significant change.

---

## Final Rule

If unsure whether a change affects more than one layer, assume that it does and inspect the repository before editing.
