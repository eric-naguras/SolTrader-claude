# SolTrader Project Todo List

Last updated: 2025-07-25T16:58:00Z

## 🔥 High Priority (Active Issues)

### In Progress
- [ ] **Apply database migration 004_expand_transaction_types.sql** (Priority: high)
  - Status: Migration file exists, needs to be applied to database
  - Files: `migrations/004_expand_transaction_types.sql`

- [ ] **Complete Solscan API integration and testing** (Priority: high)
  - Status: Implementation exists, needs testing and validation
  - Files: `src/lib/solscan-api.ts`

### Pending
- [ ] **Fix wallet watcher service database foreign key constraint error** (Priority: high)
  - Status: Critical bug causing trade recording failures
  - Error: Token must exist in `tokens` table before recording trades in `whale_trades`
  - Fix: Ensure token upsert happens before trade recording

## 🚧 Medium Priority (Development Tasks)

### In Progress
- [ ] **Finalize package.json dependency updates** (Priority: medium)
  - Status: Dependencies modified, needs verification
  - Files: `package.json`, `bun.lock`

### Pending
- [ ] **Implement token metadata scripts** (Priority: medium)
  - Tasks: fix, test, migration runner scripts
  - Location: `src/scripts/` directory

- [ ] **Enhance wallet-to-wallet transaction analysis** (Priority: medium)
  - Goal: Find related wallets through transaction patterns
  - Module: wallet-analyzer service

- [ ] **Improve token discovery and tracking** (Priority: medium)
  - Enhancement: Better token metadata handling and caching

- [ ] **Add comprehensive error handling for API integrations** (Priority: medium)
  - Focus: Helius, Solscan API error scenarios

## 📋 Low Priority (Future Enhancements)

- [ ] **Optimize database indexing for transaction queries** (Priority: low)
  - Target: `whale_trades` table performance

- [ ] **Add automated testing for new transaction types** (Priority: low)
  - Framework: Bun test with database integration

- [ ] **Implement caching for token metadata** (Priority: low)
  - Strategy: Reduce API calls and improve performance

- [ ] **Add monitoring for service health** (Priority: low)
  - Integration: Service status tracking and alerts

## 📚 Documentation Tasks

- [ ] **Update API documentation for new transaction types** (Priority: low)
  - Scope: Document expanded transaction_type enum

- [ ] **Create deployment guide for migration process** (Priority: low)
  - Content: Step-by-step migration and deployment instructions

- [ ] **Document Solscan API integration patterns** (Priority: low)
  - Content: Usage patterns and best practices

## 🏗️ Architecture Notes

**Current Branch:** `services-work-1`
**Main Branch:** `master`

**Recent Changes:**
- Service management UI with enable/disable functionality
- WalletWatcher refactored to implement Service interface
- Message bus integration for event-driven communication
- Database schema expansion for transaction types

**Technical Stack:**
- Runtime: Bun
- Framework: Hono.js
- Frontend: HTMX + Alpine.js + Pico CSS
- Database: Neon PostgreSQL with TimescaleDB
- Real-time: Server-Sent Events (SSE)

---
*This todo list is synchronized with the active development session and reflects current project priorities.*