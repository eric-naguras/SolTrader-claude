// Sonar Platform - Main JavaScript

// Update active navigation
document.addEventListener('htmx:afterSwap', (event) => {
    if (event.detail.target.id === 'main-content') {
        // Remove active state from all nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.removeAttribute('aria-current');
        });
        
        // Add active state to current page
        const currentPage = event.detail.requestConfig.path.split('/').pop() || 'dashboard';
        const activeLink = document.querySelector(`[data-page="${currentPage}"]`);
        if (activeLink) {
            activeLink.setAttribute('aria-current', 'page');
        }
    }
});

// Handle SSE messages
document.addEventListener('htmx:sseMessage', (event) => {
    const data = JSON.parse(event.detail.data);
    
    switch(data.type) {
        case 'new_trade':
            // Update trade feed if on dashboard
            const tradeFeed = document.getElementById('trade-feed');
            if (tradeFeed) {
                htmx.ajax('GET', '/htmx/partials/trade-item', {
                    target: tradeFeed,
                    swap: 'afterbegin',
                    values: data.trade
                });
            }
            break;
            
        case 'new_signal':
            // Show notification
            showToast(`New signal: ${data.signal.coin_address}`, 'success');
            
            // Update signals if on dashboard
            const signalsList = document.getElementById('signals-list');
            if (signalsList) {
                htmx.ajax('GET', '/htmx/partials/signal-item', {
                    target: signalsList,
                    swap: 'afterbegin',
                    values: data.signal
                });
            }
            break;
    }
});

// Toast notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Format timestamps
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) {
        return 'just now';
    } else if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}h ago`;
    } else {
        return date.toLocaleDateString();
    }
}

// Alpine.js data
document.addEventListener('alpine:init', () => {
    Alpine.data('walletForm', () => ({
        showForm: false,
        address: '',
        alias: '',
        tags: '',
        ui_color: '#4338ca',
        
        async submitForm() {
            const response = await fetch('http://localhost:3001/api/wallets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: this.address,
                    alias: this.alias,
                    tags: this.tags.split(',').map(t => t.trim()).filter(t => t),
                    ui_color: this.ui_color
                })
            });
            
            if (response.ok) {
                this.showForm = false;
                this.address = '';
                this.alias = '';
                this.tags = '';
                htmx.trigger('#wallets-table', 'refresh');
                showToast('Wallet added successfully', 'success');
            } else {
                const error = await response.json();
                showToast(error.error || 'Failed to add wallet', 'error');
            }
        }
    }));
    
    Alpine.data('tradeManager', () => ({
        async closePosition(id) {
            if (!confirm('Are you sure you want to close this position?')) return;
            
            const response = await fetch(`http://localhost:3001/api/trades/${id}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exitReason: 'Manual close via UI'
                })
            });
            
            if (response.ok) {
                htmx.trigger('#positions-table', 'refresh');
                showToast('Position closed successfully', 'success');
            } else {
                const error = await response.json();
                showToast(error.error || 'Failed to close position', 'error');
            }
        }
    }));
});

// Auto-refresh dashboard stats
if (window.location.pathname === '/' || window.location.pathname === '/dashboard') {
    setInterval(() => {
        htmx.trigger('#dashboard-stats', 'refresh');
    }, 30000); // Every 30 seconds
}