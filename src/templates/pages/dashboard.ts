export const dashboardPage = () => /*html*/ `<section>
    <h1>Dashboard</h1>
    
    <!-- Stats Grid with real-time updates via vanilla EventSource -->
    <div class="stats-grid" 
         id="dashboard-stats" 
         hx-get="/htmx/stats" 
         hx-trigger="load, refresh">
        <article class="stat-card">
            <h3>-</h3>
            <p>Active Wallets</p>
        </article>
        <article class="stat-card">
            <h3>-</h3>
            <p>Open Positions</p>
        </article>
        <article class="stat-card">
            <h3>-</h3>
            <p>Win Rate</p>
        </article>
        <article class="stat-card">
            <h3>-</h3>
            <p>Total PnL</p>
        </article>
    </div>

    <!-- Recent Trades with real-time updates via vanilla EventSource -->
    <section>
        <h2>Recent Whale Trades</h2>
        <div id="trade-feed" class="feed">
            <div hx-get="/htmx/trades" hx-trigger="load">
                <article aria-busy="true">Loading trades...</article>
            </div>
        </div>
    </section>

    <!-- Active Signals with real-time updates via vanilla EventSource -->
    <section>
        <h2>Active Signals</h2>
        <div id="signals-list">
            <div hx-get="/htmx/signals" hx-trigger="load">
                <article aria-busy="true">Loading signals...</article>
            </div>
        </div>
    </section>

    <!-- Open Positions -->
    <section>
        <h2>Open Positions</h2>
        <div id="positions-table" hx-get="/htmx/partials/open-positions" hx-trigger="load, refresh">
            <article aria-busy="true">Loading positions...</article>
        </div>
    </section>
</section>`;