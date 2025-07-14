// Sonar Platform - Main JavaScript

// Configure HTMX to send API key with all requests
document.addEventListener('DOMContentLoaded', function() {
    // Add API key to all HTMX requests
    htmx.on('htmx:configRequest', (event) => {
        // Only add API key for backend API calls
        if (event.detail.path.includes('localhost:3001')) {
            event.detail.headers['X-API-Key'] = window.CONFIG.API_KEY;
        }
    });
});

// Update active navigation
function updateActiveNav() {
    const path = window.location.pathname;
    
    // Remove active state from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.removeAttribute('aria-current');
    });
    
    // Determine current page from path
    let currentPage = 'dashboard';
    if (path === '/wallets') currentPage = 'wallets';
    else if (path === '/trades') currentPage = 'trades';
    else if (path === '/settings') currentPage = 'settings';
    
    // Add active state to current page
    const activeLink = document.querySelector(`[data-page="${currentPage}"]`);
    if (activeLink) {
        activeLink.setAttribute('aria-current', 'page');
    }
}

// Update on page load
document.addEventListener('DOMContentLoaded', updateActiveNav);

// Update after HTMX navigation
document.addEventListener('htmx:afterSwap', (event) => {
    if (event.detail.target.id === 'main-content') {
        updateActiveNav();
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
    } else if (diff < 604800000) {
        return `${Math.floor(diff / 86400000)}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

// Make formatTimestamp available globally for inline scripts
window.formatTimestamp = formatTimestamp;

// Alpine.js data
document.addEventListener('alpine:init', () => {
    Alpine.data('walletEditForm', () => ({
        editData: {
            address: '',
            alias: '',
            tags: '',
            ui_color: '#4338ca',
            twitter_handle: '',
            telegram_channel: '',
            streaming_channel: '',
            image_data: null,
            notes: '',
            is_active: true
        },
        
        closeModal() {
            document.getElementById('edit-wallet-modal').close();
        },
        
        async handleEditImageUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            if (file.size > 1024 * 1024) {
                showToast('Image size must be less than 1MB', 'error');
                event.target.value = '';
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                this.editData.image_data = e.target.result;
            };
            reader.readAsDataURL(file);
        },
        
        async handleEditImagePaste(event) {
            event.preventDefault();
            
            const items = event.clipboardData?.items;
            if (!items) return;
            
            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (!blob) continue;
                    
                    // Check file size (1MB limit)
                    if (blob.size > 1024 * 1024) {
                        showToast('Image size must be less than 1MB', 'error');
                        return;
                    }
                    
                    // Convert to base64
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.editData.image_data = e.target.result;
                        showToast('Image pasted successfully', 'success');
                    };
                    reader.readAsDataURL(blob);
                    break;
                }
            }
        },
        
        async updateWallet() {
            const response = await fetch(`${window.CONFIG.API_URL}/api/wallets/${this.editData.address}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-API-Key': window.CONFIG.API_KEY
                },
                body: JSON.stringify({
                    alias: this.editData.alias,
                    tags: this.editData.tags.split(',').map(t => t.trim()).filter(t => t),
                    ui_color: this.editData.ui_color,
                    twitter_handle: this.editData.twitter_handle,
                    telegram_channel: this.editData.telegram_channel,
                    streaming_channel: this.editData.streaming_channel,
                    image_data: this.editData.image_data,
                    notes: this.editData.notes,
                    is_active: this.editData.is_active
                })
            });
            
            if (response.ok) {
                this.closeModal();
                htmx.trigger('#wallets-table', 'refresh');
                showToast('Wallet updated successfully', 'success');
            } else {
                const error = await response.json();
                showToast(error.error || 'Failed to update wallet', 'error');
            }
        }
    }));
    
    Alpine.data('walletForm', () => ({
        showForm: false,
        address: '',
        alias: '',
        tags: '',
        ui_color: '#4338ca',
        twitter_handle: '',
        telegram_channel: '',
        streaming_channel: '',
        image_data: null,
        notes: '',
        
        async handleImageUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            // Check file size (1MB limit)
            if (file.size > 1024 * 1024) {
                showToast('Image size must be less than 1MB', 'error');
                event.target.value = '';
                return;
            }
            
            // Convert to base64
            const reader = new FileReader();
            reader.onload = (e) => {
                this.image_data = e.target.result;
            };
            reader.readAsDataURL(file);
        },
        
        async handleImagePaste(event) {
            event.preventDefault();
            
            const items = event.clipboardData?.items;
            if (!items) return;
            
            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (!blob) continue;
                    
                    // Check file size (1MB limit)
                    if (blob.size > 1024 * 1024) {
                        showToast('Image size must be less than 1MB', 'error');
                        return;
                    }
                    
                    // Convert to base64
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.image_data = e.target.result;
                        showToast('Image pasted successfully', 'success');
                    };
                    reader.readAsDataURL(blob);
                    break;
                }
            }
        },
        
        async submitForm() {
            const response = await fetch(`${window.CONFIG.API_URL}/api/wallets`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-API-Key': window.CONFIG.API_KEY
                },
                body: JSON.stringify({
                    address: this.address,
                    alias: this.alias,
                    tags: this.tags.split(',').map(t => t.trim()).filter(t => t),
                    ui_color: this.ui_color,
                    twitter_handle: this.twitter_handle,
                    telegram_channel: this.telegram_channel,
                    streaming_channel: this.streaming_channel,
                    image_data: this.image_data,
                    notes: this.notes
                })
            });
            
            if (response.ok) {
                this.showForm = false;
                this.address = '';
                this.alias = '';
                this.tags = '';
                this.twitter_handle = '';
                this.telegram_channel = '';
                this.streaming_channel = '';
                this.image_data = null;
                this.notes = '';
                document.getElementById('image_upload').value = '';
                htmx.trigger('#wallets-table', 'refresh');
                showToast('Wallet added successfully', 'success');
            } else {
                const error = await response.json();
                showToast(error.error || 'Failed to add wallet', 'error');
            }
        }
    }));
    
    Alpine.data('loggingConfig', () => ({
        config: {
            connection: true,
            wallet: true,
            trade: true,
            multiWhale: true,
            transaction: false,
            dataFlow: false,
            health: true,
            debug: false
        },
        lastSaved: '',
        
        async init() {
            // Load current configuration
            await this.loadConfig();
        },
        
        async loadConfig() {
            try {
                const response = await fetch(`${window.CONFIG.API_URL}/api/settings/logging`, {
                    headers: {
                        'X-API-Key': window.CONFIG.API_KEY
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.config = data.log_categories || this.config;
                }
            } catch (error) {
                console.error('Failed to load logging config:', error);
            }
        },
        
        async updateConfig() {
            try {
                const response = await fetch(`${window.CONFIG.API_URL}/api/settings/logging`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': window.CONFIG.API_KEY
                    },
                    body: JSON.stringify({ log_categories: this.config })
                });
                
                if (response.ok) {
                    this.lastSaved = new Date().toLocaleTimeString();
                    showToast('Logging configuration updated', 'success');
                } else {
                    showToast('Failed to update configuration', 'error');
                }
            } catch (error) {
                console.error('Failed to update config:', error);
                showToast('Failed to update configuration', 'error');
            }
        },
        
        async savePreset() {
            const name = prompt('Enter preset name:');
            if (name) {
                // TODO: Implement preset saving
                showToast('Preset feature coming soon', 'info');
            }
        },
        
        resetDefaults() {
            this.config = {
                connection: true,
                wallet: true,
                trade: true,
                multiWhale: true,
                transaction: false,
                dataFlow: false,
                health: true,
                debug: false
            };
            this.updateConfig();
        }
    }));
    
    Alpine.data('tradeManager', () => ({
        async closePosition(id) {
            if (!confirm('Are you sure you want to close this position?')) return;
            
            const response = await fetch(`${window.CONFIG.API_URL}/api/trades/${id}/close`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-API-Key': window.CONFIG.API_KEY
                },
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

// Edit wallet function
window.editWallet = function(address) {
    const wallet = window.walletsData[address];
    if (!wallet) {
        showToast('Wallet data not found', 'error');
        return;
    }
    
    // Get Alpine component
    const modal = document.getElementById('edit-wallet-modal');
    const alpineComponent = Alpine.$data(modal.querySelector('[x-data]'));
    
    // Populate form with wallet data
    alpineComponent.editData = {
        address: wallet.address,
        alias: wallet.alias || '',
        tags: wallet.tags ? wallet.tags.join(', ') : '',
        ui_color: wallet.ui_color || '#4338ca',
        twitter_handle: wallet.twitter_handle || '',
        telegram_channel: wallet.telegram_channel || '',
        streaming_channel: wallet.streaming_channel || '',
        image_data: wallet.image_data || null,
        notes: wallet.notes || '',
        is_active: wallet.is_active !== false
    };
    
    // Clear file input
    const fileInput = document.getElementById('edit-image');
    if (fileInput) fileInput.value = '';
    
    // Open modal
    modal.showModal();
};