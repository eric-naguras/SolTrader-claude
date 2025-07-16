export const activeSignalsPartial = () => `<div id="signals-container">
    <!-- Signals will be loaded from database -->
</div>

<script>
// Load real signals from database
async function loadSignals() {
    try {
        const response = await fetch('/api/signals');
        const signals = await response.json();
        
        const container = document.getElementById('signals-container');
        
        if (signals.length === 0) {
            container.innerHTML = '<p style="color: var(--pico-muted-color); text-align: center; padding: 2rem;">No active signals found</p>';
            return;
        }
        
        const signalsHtml = signals.map(signal => {
            const tokenSymbol = signal.tokens?.symbol || 'Unknown';
            const coinAddress = signal.coin_address;
            const timeAgo = getTimeAgo(signal.created_at);
            
            return \`
                <article style="border-left: 4px solid var(--pico-primary); padding-left: 1rem;">
                    <header>
                        <strong>\${tokenSymbol}</strong>
                        <small style="float: right; color: var(--pico-muted-color);">\${timeAgo}</small>
                    </header>
                    <p style="margin: 0.5rem 0;">
                        <span class="status-badge open">\${signal.status}</span>
                        <span style="margin-left: 1rem;">\${signal.trigger_reason || 'Whale activity detected'}</span>
                    </p>
                    <small>
                        <code>\${coinAddress.slice(0, 8)}...\${coinAddress.slice(-4)}</code>
                        <a href="https://dexscreener.com/solana/\${coinAddress}" target="_blank" style="margin-left: 1rem;">View on DexScreener →</a>
                    </small>
                </article>
            \`;
        }).join('');
        
        container.innerHTML = signalsHtml;
    } catch (error) {
        console.error('Error loading signals:', error);
        document.getElementById('signals-container').innerHTML = '<p style="color: var(--pico-color-red-500);">Error loading signals</p>';
    }
}

function getTimeAgo(timestamp) {
    const now = new Date();
    const signalTime = new Date(timestamp);
    const diffMs = now - signalTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return \`\${diffDays}d ago\`;
    if (diffHours > 0) return \`\${diffHours}h ago\`;
    if (diffMins > 0) return \`\${diffMins}m ago\`;
    return 'just now';
}

// Load signals when page loads
loadSignals();

// Listen for new signals via SSE
document.addEventListener('htmx:sseMessage', (event) => {
    if (event.detail.data.type === 'new_signal') {
        const signal = event.detail.data.signal;
        const newSignal = document.createElement('article');
        newSignal.style.cssText = 'border-left: 4px solid var(--pico-primary); padding-left: 1rem;';
        newSignal.innerHTML = \`
            <header>
                <strong>\${signal.token_symbol || 'Unknown'}</strong>
                <small style="float: right; color: var(--pico-muted-color);">just now</small>
            </header>
            <p style="margin: 0.5rem 0;">
                <span class="status-badge open">OPEN</span>
                <span style="margin-left: 1rem;">\${signal.whale_count} whales bought</span>
            </p>
            <small>
                <code>\${signal.coin_address}</code>
                <a href="https://dexscreener.com/solana/\${signal.coin_address}" target="_blank" style="margin-left: 1rem;">View on DexScreener →</a>
            </small>
        \`;
        
        const container = document.getElementById('signals-container');
        container.insertBefore(newSignal, container.firstChild);
        
        // Keep only last 5 signals
        while (container.children.length > 5) {
            container.removeChild(container.lastChild);
        }
    }
});
</script>`;