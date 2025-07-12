Of course. I have analyzed the four provided Product Requirements Documents and synthesized them into a single, comprehensive master PRD.

This new document, titled **Project Sonar**, integrates the best structural elements, features, and strategic thinking from all sources. It uses the detailed, table-based feature specification from the "Gemini" PRD, incorporates the business and platform vision from the "Claude" PRD, includes the practical, phased checklists from the "ChatGPT" PRD, and adds the direct, stage-based objectives from the "Grok" PRD.

The result is a detailed, non-redundant, and actionable blueprint designed to be clear enough for an AI coding agent or a development team to begin work.

---

# **Master Product Requirements Document (PRD)**
# **Project Sonar: Whale Wallet Intelligence Platform**

**Version:** 2.0
**Status:** Ready for Development

Here is a video about creating MCP serevrs: https://www.youtube.com/watch?v=Zw3sfAIpeH8


## 1. Introduction & Vision

### 1.1 Executive Summary
Project Sonar is a sophisticated, data-driven trading intelligence and execution platform for the Solana ecosystem. Its primary function is to monitor the on-chain activity of high-net-worth wallets ("whales") to identify early investment opportunities in memecoins.

### 1.2 Product Vision
To democratize access to whale trading patterns and create an intelligent system that learns from the most successful traders on Solana. By systematically detecting coordinated buy signals, executing trades with minimal latency, and managing positions with intelligent exit strategies, Sonar aims to provide a significant, data-driven edge to its users, enabling them to move faster than the retail crowd.

### 1.3 Core Problem Statement
Retail and semi-professional traders lack visibility into the coordinated, early-stage activities of successful whale wallets. Manual tracking is impossible at scale, and by the time a trend becomes public, the primary profit opportunity has often passed. This creates an information asymmetry that Sonar aims to solve.

## 2. Goals & Objectives (OKRs)

- **Objective 1: Provide users with timely, actionable, and high-signal trading alerts.**
    - **KR1:** Detect over 98% of all SPL-token purchase transactions from a list of 100+ tracked whale wallets.
    - **KR2:** Ensure notification latency (from on-chain confirmation to user alert) is under 5 seconds.
    - **KR3:** Achieve a >70% "win rate" on paper trades, where a "win" is defined as a flagged coin seeing a >20% price move within 24 hours of the signal.

- **Objective 2: Develop a reliable, semi-automated trading system.**
    - **KR1:** Successfully execute 99.5% of trade orders (buy/sell) triggered by a valid signal during live testing.
    - **KR2:** Integrate with at least two distinct trade execution methods (e.g., a trading bot API like Maestro and a direct DEX aggregator API like Jupiter).
    - **KR3:** Maintain system uptime of 99.9% for all critical monitoring and trading services.

- **Objective 3: Create a robust data pipeline for continuous strategy improvement.**
    - **KR1:** Log all trade signals, outcomes (profitable, false signal, etc.), and market conditions.
    - **KR2:** Develop an exportable dataset suitable for ML model fine-tuning with at least 1,000 labeled trade events.

## 3. User Personas

1.  **Individual Retail Trader ("The Sophisticated Degen")**
    - **Background:** A tech-savvy crypto trader active in DeFi. Understands the high-risk nature of memecoins but is tired of relying on social media hype and wants a data-driven edge.
    - **Goals:** Find early alpha, automate the tedious process of wallet-watching, and manage risk with systematic entry/exit rules.
    - **Frustration:** "By the time I hear about a coin on Twitter, I'm already someone else's exit liquidity. I know smart money moves first, but I can't see it in an aggregated, real-time way."

2.  **Power User / Researcher**
    - **Background:** An analyst or advanced trader who performs deep on-chain analysis.
    - **Goals:** Access detailed whale tracking data, visualize capital flow, identify wallet networks/aliases, and use raw data to inform their own manual trading or research.
    - **Frustration:** "Manually tracing transfers across multiple wallets to uncover a single entity's true position is a full-time job."

## 4. Features & Requirements

Features are organized into logical phases, starting with a Proof of Concept and progressively adding functionality.

### **Phase 1: The Listener (Proof of Concept & Core Monitoring)**

| ID | Feature | User Story | Priority | Details & Acceptance Criteria |
|---|---|---|---|---|
| P1-01 | **Whale Wallet Management** | As an operator, I want to add, remove, and label a list of whale wallets so I can define the tracking scope. | **Must-Have** | - A database table to store wallet addresses, aliases, and categories (e.g., "OG Whale," "VC").<br>- Ability to mark wallets as active/inactive for monitoring. |
| P1-02 | **Real-time Transaction Monitoring** | As the system, I need to watch all transactions from the active whale list in near real-time. | **Must-Have** | - Subscribe to account updates for all active whale wallets via WebSockets.<br>- Process incoming transaction signatures and parse transaction details. |
| P1-03 | **Memecoin Purchase Detection** | As a user, I want the system to identify when a whale buys a memecoin (SPL token). | **Must-Have** | - Filter transactions involving a DEX (Raydium, Orca) or aggregator (Jupiter).<br>- Differentiate buys (SOL/USDC -> Token) from sells.<br>- Log the coin address, buy amount (in token and USD), wallet address, transaction hash, and timestamp. |
| P1-04 | **Multi-Whale Signal Generation** | As a user, I want to be notified only when a critical mass of whales buys the same coin in a short period. | **Must-Have** | - A configurable rule engine (e.g., `N` whales buying the same coin within `T` hours).<br>- When the rule is met, a "Signal" is generated and logged.<br>- The signal must include the coin, list of triggering whale transactions, and rule parameters. |
| P1-05 | **Multi-Channel Notification System** | As a user, I want to receive an instant alert via my preferred channel when a new signal is generated. | **Must-Have** | - Integrated delivery to CLI, Discord, and Telegram.<br>- Alert message must contain: Coin Address (with a link to DexScreener/Birdeye), number of whales, and a list of the whale aliases who bought in. |
| P1-06 | **Paper Trading System** | As a user, I want the system to automatically record a "paper trade" to track the performance of every signal. | **Must-Have** | - On signal generation, fetch and log the coin's entry price, timestamp, and virtual portfolio.<br>- The trade is marked as "open" in the database. |
| P1-07 | **Whale Exit & Transfer Tracking** | As a user, I want the system to detect when original whales sell or transfer tokens, so I can evaluate exit signals. | **Should-Have** | - Monitor whales for sell transactions of the signaled coin.<br>- Detect direct SOL/USDC/Token transfers between tracked wallets or to new, high-value wallets.<br>- Detect and flag transfers to known Centralized Exchange (CEX) deposit addresses. |

### **Phase 2: The Hunter (Automated Trade Execution)**

| ID | Feature | User Story | Priority | Details & Acceptance Criteria |
|---|---|---|---|---|
| P2-01 | **Secure Credential Management** | As an operator, I need a secure way to store user API keys and wallet information for trading. | **Must-Have** | - Use a secure vault service or environment variables for API keys.<br>- All sensitive data must be encrypted at rest and in transit. The system will **never** store user private keys. |
| P2-02 | **Trading Bot & DEX Integration** | As a user, I want the system to automatically execute a trade via my preferred method when a signal is generated. | **Must-Have** | - Integrate with popular trading bot APIs (e.g., Maestro, BonkBot, Trojan).<br>- Integrate with a direct DEX aggregator API (e.g., Jupiter) for more control.<br>- A toggle to switch between paper, bot, and direct DEX trading modes. |
| P2-03 | **Dynamic Trade & Risk Configuration** | As a user, I want to configure my trade parameters to manage risk. | **Must-Have** | - Configurable trade size (e.g., 0.5 SOL), slippage tolerance, and priority fees.<br>- Portfolio-level risk management: max exposure per token, total memecoin allocation, and daily drawdown protection. |
| P2-04 | **MEV & Rug Pull Protection** | As a user, I want the system to protect my trades from common on-chain threats. | **Should-Have** | - Option to use private RPC endpoints or anti-sandwich techniques for MEV protection.<br>- Basic pre-trade checks: verify minimum liquidity and check for locked liquidity/mint authority renounced. |

### **Phase 3: The Guardian (Advanced Exit Strategies)**

| ID | Feature | User Story | Priority | Details & Acceptance Criteria |
|---|---|---|---|---|
| P3-01 | **Trailing Take-Profit Bot** | As a user, I want a bot that automatically sells my position if the price drops by a certain percentage from its peak. | **Must-Have** | - A configurable trailing percentage per trade (e.g., "sell if price drops 15% from the highest point since entry").<br>- A simple command or UI button to manually close any open position immediately. |
| P3-02 | **Advanced & Partial Exits** | As a user, I want to scale out of my positions intelligently to lock in profits. | **Should-Have** | - Support for partial exits (e.g., "sell 50% at +100% profit, trail the rest").<br>- Whale-based exits: Option to automatically sell when one or more of the original whale buyers sell their position. |
| P3-03 | **AI-Optimized Exit Parameters** | As a user, I want the system to learn from past data to suggest better exit strategies. | **Could-Have** | - Feed all trade performance data into an ML model to optimize trailing stop parameters based on token volatility and market conditions. |

### **Phase 4: The Scout (Whale Discovery & Intelligence)**

| ID | Feature | User Story | Priority | Details & Acceptance Criteria |
|---|---|---|---|---|
| P4-01 | **Wallet Discovery Engine** | As a user, I want the system to find and suggest new, profitable whale wallets for me to track. | **Must-Have** | - Scrape DEX data to identify wallets making large-volume trades.<br>- Analyze top holders of new, promising tokens.<br>- Score potential whales based on their historical PnL and win rate. |
| P4-02 | **Wallet Network Graphing** | As a user, I want to see connections between wallets to understand capital flow and identify aliases. | **Should-Have** | - Analyze historical transfers to build a wallet linkage graph.<br>- Detect wallet splits/merges and automatically group related wallets.<br>- Visualize the wallet network, showing transfers between whales and to/from CEXs. |
| P4-03 | **Insider & Fresh Wallet Detection** | As a user, I want to flag wallets that may have insider information. | **Could-Have** | - Flag wallets that consistently buy tokens moments after creation and before major price moves.<br>- Monitor new wallets that receive large initial funding from known whale or exchange wallets. |

### **Phase 5: The Bridge (Dashboard & Platform)**

| ID | Feature | User Story | Priority | Details & Acceptance Criteria |
|---|---|---|---|---|
| P5-01 | **Comprehensive CLI Toolkit** | As a developer, I want a modular set of CLI tools to manage and interact with the system. | **Must-Have** | - CLI tools for: `wallet-manage`, `signal-monitor`, `trade-execute`, `performance-report`.<br>- All tools should interact with the central database (Supabase). |
| P5-02 | **Real-time Analytics Dashboard** | As a user, I want a dashboard to visualize whale activity, my positions, and overall performance. | **Should-Have** | - A web-based dashboard powered by real-time database updates.<br>- Key components: Live signal feed, open positions, trade history, PnL analysis, whale leaderboard (by profitability), and a coin heatmap of current whale inflows. |
| P5-03 | **API & External Integrations** | As a power user, I want API access to integrate Sonar's data into my own systems. | **Could-Have** | - A REST API for programmatic access to signals and whale data.<br>- Webhook system to push real-time alerts to external services.<br>- TradingView integration to visualize whale buy/sell signals on charts. |

## 5. Non-Functional Requirements

- **Performance:** Signal detection and notification latency must be **< 5 seconds**. Trade execution latency should be **< 2 seconds**.
- **Reliability:** The system must achieve **99.9% uptime** with robust error handling and automatic reconnection logic for RPC/WebSocket connections.
- **Scalability:** The architecture must scale from tracking 100 wallets to over 1,000 without a major redesign.
- **Security:** User trading credentials and API keys must be encrypted at rest (AES-256). The system will **never** ask for or store user private keys. All communication must be over secure channels (HTTPS, WSS).
- **Architecture:** A modular, **CLI-first architecture** is preferred for the backend, allowing components to be developed and run independently.
- **Cost-Effectiveness:** Infrastructure choices for the PoC and early phases should prioritize free/developer tiers (e.g., Supabase, Helius free tiers).

## 6. Proposed Technical Stack & Architecture

- **Blockchain Interaction:** Helius or QuickNode for RPC access (primary with failover). WebSockets for real-time monitoring.
- **Backend:** Node.js/TypeScript or Python. A modular, microservices-style architecture is recommended.
- **Database:** Supabase (PostgreSQL) for its real-time capabilities, authentication, and simple backend features.
- **Execution:** Integration with Jupiter API for direct swaps, and REST/WebSocket APIs for trading bots (Maestro, etc.).
- **Frontend (Dashboard):** A modern web framework like Next.js or SvelteKit.
- **Notifications:** Direct API integrations with Telegram and Discord.
- **Deployment:** Containerized deployment (Docker) on a cloud provider like Vercel (for frontend) and a scalable serverless or small VM provider for backend services (e.g., Railway, Fly.io).

## 7. Success Metrics & KPIs
- **Primary Metric:** Net Profit/Loss (both paper and live trading) vs. a benchmark (e.g., holding SOL).
- **Key Performance Indicators:**
    - Signal-to-Win Ratio (% of signals leading to a profitable trade).
    - Average ROI per trade.
    - Signal & Trade Latency (in seconds).
    - System Uptime.
    - Number of new, profitable whale wallets discovered by the "Scout" engine.
    - User Retention & Active Trading Users.

## 8. Monetization Strategy (Future)

- **Free Tier:** Delayed alerts (e.g., 15 min), tracking for 5 pre-selected whales.
- **Pro Tier ($99/mo):** Real-time alerts, tracking for 100 whales, paper trading, basic analytics.
- **Elite Tier ($299/mo):** All features, 200+ whale tracking, automated trading, advanced analytics, API access.
- **Enterprise (Custom):** White-label solutions, custom whale lists, dedicated support.

## 9. Risks & Mitigation

| Risk | Mitigation Strategy |
|---|---|
| **RPC Provider Downtime** | Use multiple RPC providers (e.g., Helius, QuickNode) with an automated failover mechanism. |
| **Whale Obfuscation** | Implement robust wallet network analysis (Phase 4) to track capital through new wallets and detect aliasing. |
| **Market/Regulatory Risk** | Maintain a flexible architecture to adapt to changes. Include clear risk disclaimers and ToS. Do not provide financial advice. |
| **Smart Contract Exploits** | The system is off-chain, but for coins it trades, it will perform basic safety checks (liquidity locked, etc.). |
| **High Network Congestion** | Implement dynamic priority fee calculations to ensure transaction inclusion during volatile periods. |

## 10. Glossary

- **Whale**: A Solana wallet with a high-value balance, considered a market mover.
- **CEX**: Centralized Exchange (e.g., Coinbase, Binance).
- **SPL Token**: The standard for fungible tokens on the Solana blockchain.
- **Paper Trade**: A simulated trade to test a strategy without risking real capital.
- **Trailing Take-Profit**: A dynamic exit strategy where the sell order follows the price up and executes when it retracts by a set percentage from its peak.
- **MEV (Maximal Extractable Value)**: Profit extracted from block production, often through front-running or sandwich attacks.
