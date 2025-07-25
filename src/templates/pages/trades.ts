export const tradesPage = () => /*html*/ `<section x-data="tradeManager">
    <h1>Trade History</h1>
    
    <!-- Trade Filters -->
    <details>
        <summary>Filters</summary>
        <form hx-get="/htmx/partials/trades-table" hx-target="#trades-table">
            <div class="grid">
                <div>
                    <label for="status">
                        Status
                        <select id="status" name="status">
                            <option value="">All</option>
                            <option value="OPEN">Open</option>
                            <option value="CLOSED">Closed</option>
                        </select>
                    </label>
                </div>
                <div>
                    <label for="date-range">
                        Date Range
                        <select id="date-range" name="date_range">
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                        </select>
                    </label>
                </div>
                <div>
                    <label for="coin">
                        Token
                        <input type="text" id="coin" name="coin" placeholder="Token address or symbol">
                    </label>
                </div>
            </div>
            <button type="submit">Apply Filters</button>
        </form>
    </details>

    <!-- Performance Summary -->
    <div id="performance-summary" hx-get="/htmx/partials/performance-summary" hx-trigger="load">
        <article aria-busy="true">Loading performance data...</article>
    </div>

    <!-- Trades Table with real-time updates -->
    <div id="trades-table" 
         hx-get="/htmx/partials/trades-table" 
         hx-trigger="load">
        <article aria-busy="true">Loading trades...</article>
    </div>
</section>`;