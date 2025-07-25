export const recentTradesPartial = () => `<div id="trades-container" style="height: 40vh; overflow-y: auto; overflow-x: hidden;">
    <div id="trades-feed" class="wallet-trades-grid">
        <!-- Wallet trade cards will be loaded from database -->
    </div>
</div>

<script type="module">
// Import wallet trade classes
import { WalletTradeManager } from '/js/wallet-trades.js';

// Store wallet manager instance
window.walletTradeManager = new WalletTradeManager();

// Load real trades from database
async function loadRecentTrades() {
    try {
        console.log('Loading recent trades...');
        const response = await fetch('/api/trades?limit=100', {
            headers: {
                'X-API-Key': window.CONFIG?.API_KEY || 'test-api-key'
            }
        });
        
        if (!response.ok) {
            throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        }
        
        const trades = await response.json();
        console.log('Loaded trades:', trades.length, trades);
        
        const feed = document.getElementById('trades-feed');
        
        if (trades.length === 0) {
            feed.innerHTML = '<p style="color: var(--pico-muted-color); text-align: center; padding: 2rem; grid-column: 1 / -1;">No recent trades found</p>';
            return;
        }
        
        // Clear existing wallets
        window.walletTradeManager.clear();
        
        // Group trades by wallet
        trades.forEach(trade => {
            const tokenSymbol = trade.token_symbol || 'Unknown';
            const tokenName = trade.token_name;
            const walletAlias = trade.wallet_alias || \`\${trade.wallet_address.slice(0, 8)}...\${trade.wallet_address.slice(-4)}\`;
            const walletColor = trade.wallet_color || '#4338ca';
            const isVerified = trade.is_verified || false;
            const twitterHandle = trade.twitter_handle;
            const telegramChannel = trade.telegram_channel;
            const streamingChannel = trade.streaming_channel;
            const imageData = trade.image_data;
            
            const tradeData = {
                id: trade.id,
                trade_type: trade.trade_type,
                sol_amount: trade.sol_amount || 0,
                token_amount: trade.token_amount,
                token_symbol: tokenSymbol,
                token_name: tokenName,
                token_address: trade.coin_address,
                price_usd: trade.price_usd,
                transaction_hash: trade.transaction_hash,
                trade_timestamp: trade.trade_timestamp,
                time_ago: getTimeAgo(trade.trade_timestamp)
            };
            
            window.walletTradeManager.addTrade(
                trade.wallet_address,
                tradeData,
                walletAlias,
                walletColor,
                isVerified,
                twitterHandle,
                telegramChannel,
                streamingChannel,
                imageData
            );
        });
        
        // Render sorted wallets
        renderWallets();
    } catch (error) {
        console.error('Error loading trades:', error);
        document.getElementById('trades-feed').innerHTML = '<p style="color: var(--pico-color-red-500);">Error loading trades</p>';
    }
}

function renderWallets() {
    const feed = document.getElementById('trades-feed');
    const sortedWallets = window.walletTradeManager.getSortedWallets();
    
    // Get existing cards
    const existingCards = Array.from(feed.querySelectorAll('.wallet-trade-card'));
    const existingCardMap = new Map();
    existingCards.forEach(card => {
        const walletAddress = card.getAttribute('data-wallet');
        if (walletAddress) {
            existingCardMap.set(walletAddress, card);
        }
    });
    
    // Create a document fragment for efficient DOM manipulation
    const fragment = document.createDocumentFragment();
    
    // Process each wallet in the correct order
    sortedWallets.forEach((wallet, index) => {
        const existingCard = existingCardMap.get(wallet.walletAddress);
        
        if (existingCard) {
            // Update existing card content and add update animation
            existingCard.innerHTML = getCardInnerHTML(wallet);
            existingCard.classList.add('updated');
            
            // Remove animation class after animation completes
            setTimeout(() => {
                existingCard.classList.remove('updated');
            }, 500);
            
            // Remove from map so we know it's been processed
            existingCardMap.delete(wallet.walletAddress);
            fragment.appendChild(existingCard);
        } else {
            // Create new card
            const newCard = document.createElement('article');
            newCard.className = 'wallet-trade-card';
            newCard.setAttribute('data-wallet', wallet.walletAddress);
            newCard.innerHTML = getCardInnerHTML(wallet);
            fragment.appendChild(newCard);
        }
    });
    
    // Remove any cards that no longer exist
    existingCardMap.forEach(card => card.remove());
    
    // Clear and append the reordered cards
    feed.innerHTML = '';
    feed.appendChild(fragment);
}

function getCardInnerHTML(wallet) {
    // Show only the first 5 trades
    const visibleTrades = wallet.trades.slice(0, 5);
    const tradesHTML = visibleTrades.map(trade => {
        const timeAgo = formatTimeAgo(trade.trade_timestamp);
        const solAmount = parseFloat(trade.sol_amount || 0).toFixed(2);
        const typeClass = trade.trade_type.toLowerCase();
        // Abbreviate trade type
        const typeDisplay = trade.trade_type === 'BUY' ? 'B' : 'S';
        // Use token name if available, otherwise symbol, otherwise truncated address, otherwise 'Unknown'
        let tokenDisplay = trade.token_name || trade.token_symbol || 'Unknown';
        
        // If we still don't have a proper name and we have a token address, show truncated address
        if (tokenDisplay === 'Unknown' && trade.token_address && trade.token_address !== 'So11111111111111111111111111111111111111112') {
          tokenDisplay = \`\${trade.token_address.slice(0, 4)}...\${trade.token_address.slice(-4)}\`;
        }
        
        // Never show SOL for the other token in swaps
        if (tokenDisplay === 'SOL' && trade.token_address === 'So11111111111111111111111111111111111111112') {
          tokenDisplay = 'Unknown';
        }
        return \`
      <div class="trade-row">
        <span class="trade-type \${typeClass}">\${typeDisplay}</span>
        <span class="trade-amount">\${solAmount} Sol</span>
        <span class="trade-token" title="\${trade.token_name || trade.token_symbol || 'Unknown'}">\${tokenDisplay}</span>
        <span class="trade-time">\${timeAgo}</span>
      </div>
    \`;
    }).join('');
    
    // Build social links
    let socials = [];
    if (wallet.twitterHandle)
        socials.push(\`<a href="https://twitter.com/\${wallet.twitterHandle.replace('@', '')}" target="_blank" title="Twitter">🐦</a>\`);
    if (wallet.telegramChannel)
        socials.push(\`<a href="\${wallet.telegramChannel.startsWith('http') ? wallet.telegramChannel : 'https://' + wallet.telegramChannel}" target="_blank" title="Telegram">💬</a>\`);
    if (wallet.streamingChannel)
        socials.push(\`<a href="\${wallet.streamingChannel.startsWith('http') ? wallet.streamingChannel : 'https://' + wallet.streamingChannel}" target="_blank" title="Stream">📺</a>\`);
    const socialsHtml = socials.length > 0 ? \`<div class="wallet-socials">\${socials.join(' ')}</div>\` : '';
    
    // Build wallet avatar - use wallet image if available, otherwise create colored circle
    const avatarHtml = wallet.walletImageData
        ? \`<img src="\${wallet.walletImageData}" alt="\${wallet.walletAlias}" class="wallet-avatar">\`
        : \`<div class="wallet-avatar" style="background-color: \${wallet.walletColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 0.75rem;">\${wallet.walletAlias.charAt(0).toUpperCase()}</div>\`;
    
    return \`
    <div class="wallet-header">
      <div class="wallet-info">
        \${avatarHtml}
        <strong class="wallet-name">\${wallet.walletAlias}</strong>
        \${wallet.isVerified ? '<span class="verified-badge">✓</span>' : ''}
      </div>
      \${socialsHtml}
    </div>
    <div class="trades-list">
      \${tradesHTML}
    </div>
  \`;
}

function formatTimeAgo(timestamp) {
    const now = new Date();
    const tradeTime = new Date(timestamp);
    const diffMs = now - tradeTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return \`\${diffDays}d\`;
    if (diffHours > 0) return \`\${diffHours}h\`;
    if (diffMins > 0) return \`\${diffMins}m\`;
    return 'now';
}

function getTimeAgo(timestamp) {
    const now = new Date();
    const tradeTime = new Date(timestamp);
    const diffMs = now - tradeTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return \`\${diffDays}d ago\`;
    if (diffHours > 0) return \`\${diffHours}h ago\`;
    if (diffMins > 0) return \`\${diffMins}m ago\`;
    return 'just now';
}

// Load trades on page load
loadRecentTrades();

// Real-time updates via SSE only - no Supabase Realtime
console.log('[SSE] Using Server-Sent Events for real-time updates');

// Listen for real-time updates via SSE (primary method due to Realtime issues)
document.addEventListener('htmx:sseMessage', (event) => {
    try {
        const data = JSON.parse(event.detail.data);
        
        if (data.type === 'new_trade') {
            const trade = data.trade;
            console.log('[SSE] Received new trade:', trade);
            
            // Extract token information - check multiple possible paths
            const tokenSymbol = trade.tokens?.symbol || trade.token_symbol || null;
            const tokenName = trade.tokens?.name || trade.token_name || null;
            
            // Extract wallet information
            const walletAlias = trade.tracked_wallets?.alias || trade.wallet_alias || \`\${trade.wallet_address.slice(0, 8)}...\`;
            const walletColor = trade.tracked_wallets?.ui_color || trade.wallet_color || '#4338ca';
            const isVerified = trade.tracked_wallets?.is_verified || trade.is_verified || false;
            const twitterHandle = trade.tracked_wallets?.twitter_handle;
            const telegramChannel = trade.tracked_wallets?.telegram_channel;
            const streamingChannel = trade.tracked_wallets?.streaming_channel;
            const imageData = trade.tracked_wallets?.image_data;
            
            const tradeData = {
                id: trade.id || Date.now(),
                trade_type: trade.trade_type,
                sol_amount: trade.sol_amount || 0,
                token_amount: trade.token_amount,
                token_symbol: tokenSymbol,
                token_name: tokenName,
                token_address: trade.coin_address,
                price_usd: trade.price_usd,
                transaction_hash: trade.transaction_hash,
                trade_timestamp: trade.trade_timestamp || new Date().toISOString(),
                time_ago: 'just now'
            };
            
            // Add to manager
            window.walletTradeManager.addTrade(
                trade.wallet_address,
                tradeData,
                walletAlias,
                walletColor,
                isVerified,
                twitterHandle,
                telegramChannel,
                streamingChannel,
                imageData
            );
            
            // Re-render wallets
            renderWallets();
            
            // Scroll to top to show new trade
            document.getElementById('trades-container').scrollTop = 0;
        } else if (data.type === 'connected') {
            console.log('[SSE] ✓ Connected to real-time events stream');
        } else if (data.type === 'ping') {
            // Ignore ping messages
        } else {
            console.log('[SSE] Received unknown message type:', data.type);
        }
    } catch (error) {
        console.error('[SSE] Error processing SSE message:', error);
    }
});

// Add SSE connection status logging
document.addEventListener('htmx:sseOpen', () => {
    console.log('[SSE] ✓ SSE connection opened');
});

document.addEventListener('htmx:sseError', (event) => {
    console.error('[SSE] ✗ SSE connection error:', event);
});

document.addEventListener('htmx:sseClose', () => {
    console.log('[SSE] ⚠ SSE connection closed');
});
</script>`;