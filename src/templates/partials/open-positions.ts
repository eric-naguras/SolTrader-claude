export const openPositionsPartial = () => `<div x-data="{ positions: [] }">
    <table>
        <thead>
            <tr>
                <th>Token</th>
                <th>Entry Price</th>
                <th>Current Price</th>
                <th>PnL</th>
                <th>Size (SOL)</th>
                <th>Time Held</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody id="positions-list">
            <tr>
                <td colspan="7" style="text-align: center;">
                    <span aria-busy="true">Loading positions...</span>
                </td>
            </tr>
        </tbody>
    </table>
</div>

<script>
// Fetch open positions
fetch('http://localhost:3001/api/trades/positions', {
    headers: {
        'X-API-Key': window.CONFIG.API_KEY
    }
})
    .then(r => r.json())
    .then(data => {
        const tbody = document.getElementById('positions-list');
        tbody.innerHTML = '';
        
        if (data.positions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No open positions</td></tr>';
            return;
        }
        
        data.positions.forEach(position => {
            const tokenInfo = position.token || {};
            const timeSince = formatTimestamp(position.entry_timestamp);
            
            const row = document.createElement('tr');
            row.innerHTML = \`
                <td>
                    <strong>\${tokenInfo.symbol || 'Unknown'}</strong><br>
                    <small><code>\${position.coin_address.slice(0, 8)}...</code></small>
                </td>
                <td>$\${position.entry_price?.toFixed(6) || '-'}</td>
                <td>$\${position.current_price?.toFixed(6) || '-'}</td>
                <td class="\${position.pnl_percentage > 0 ? 'pnl-positive' : 'pnl-negative'}">
                    \${position.pnl_percentage ? (position.pnl_percentage > 0 ? '+' : '') + position.pnl_percentage.toFixed(2) + '%' : '-'}
                </td>
                <td>\${position.trade_amount_sol || '-'}</td>
                <td>\${timeSince}</td>
                <td>
                    <button class="outline" onclick="closePosition('\${position.id}')" 
                            style="padding: 0.25rem 0.5rem; font-size: 0.875rem;">
                        Close
                    </button>
                </td>
            \`;
            tbody.appendChild(row);
        });
    })
    .catch(err => {
        document.getElementById('positions-list').innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--pico-del-color);">Failed to load positions</td></tr>';
    });

// Close position function
async function closePosition(id) {
    if (!confirm('Are you sure you want to close this position?')) return;
    
    try {
        const response = await fetch(\`http://localhost:3001/api/trades/\${id}/close\`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': window.CONFIG.API_KEY
            },
            body: JSON.stringify({ exitReason: 'Manual close via UI' })
        });
        
        if (response.ok) {
            htmx.trigger('#positions-table', 'refresh');
            htmx.trigger('#dashboard-stats', 'refresh');
            showToast('Position closed successfully', 'success');
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to close position', 'error');
        }
    } catch (err) {
        showToast('Failed to close position', 'error');
    }
}
</script>`;