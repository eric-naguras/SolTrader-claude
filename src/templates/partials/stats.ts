export const statsPartial = () => `<div class="stats-grid" id="stats-container">
    <article class="stat-card">
        <h3 id="active-wallets">-</h3>
        <p>Active Wallets</p>
    </article>
    <article class="stat-card">
        <h3 id="active-signals">-</h3>
        <p>Active Signals</p>
    </article>
    <article class="stat-card">
        <h3 id="total-trades">-</h3>
        <p>Total Trades</p>
    </article>
    <article class="stat-card">
        <h3 id="win-rate">-</h3>
        <p>Win Rate</p>
    </article>
</div>

<script>
// Load real stats from database
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        document.getElementById('active-wallets').textContent = stats.activeWallets;
        document.getElementById('active-signals').textContent = stats.activeSignals;
        document.getElementById('total-trades').textContent = stats.totalTrades;
        document.getElementById('win-rate').textContent = 'N/A'; // We'll calculate this later when we have trade results
        
    } catch (error) {
        console.error('Error loading stats:', error);
        // Show error in stats
        document.getElementById('active-wallets').textContent = 'Error';
        document.getElementById('active-signals').textContent = 'Error';
        document.getElementById('total-trades').textContent = 'Error';
        document.getElementById('win-rate').textContent = 'Error';
    }
}

// Load stats when page loads
loadStats();
</script>`;