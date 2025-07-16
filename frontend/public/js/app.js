// Sonar Platform - Main JavaScript

// Shared Wallet Cache Service - Singleton to prevent duplicate API calls
window.WalletCache = (() => {
    let cache = null;
    let isLoading = false;
    let loadPromise = null;
    
    return {
        async getWallets() {
            // Return cached data if available
            if (cache) {
                return cache;
            }
            
            // If already loading, return the existing promise
            if (isLoading && loadPromise) {
                return loadPromise;
            }
            
            // Start loading
            isLoading = true;
            loadPromise = this.loadWallets();
            
            try {
                const wallets = await loadPromise;
                cache = wallets;
                return wallets;
            } finally {
                isLoading = false;
                loadPromise = null;
            }
        },
        
        async loadWallets() {
            const response = await fetch(`${window.CONFIG.API_URL}/api/wallets`, {
                headers: {
                    'X-API-Key': window.CONFIG.API_KEY
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load wallets: ${response.status}`);
            }
            
            const data = await response.json();
            
            // API returns { wallets: [...] }, extract the wallets array
            let wallets = [];
            if (data && data.wallets && Array.isArray(data.wallets)) {
                wallets = data.wallets;
            } else if (Array.isArray(data)) {
                wallets = data;
            } else {
                console.warn('Unexpected API response format:', data);
                wallets = [];
            }
            
            return wallets;
        },
        
        // Update cache with new/modified wallet
        updateWallet(wallet) {
            if (cache) {
                const index = cache.findIndex(w => w.address === wallet.address);
                if (index >= 0) {
                    cache[index] = wallet;
                } else {
                    cache.push(wallet);
                }
            }
        },
        
        // Remove wallet from cache
        removeWallet(address) {
            if (cache) {
                cache = cache.filter(w => w.address !== address);
            }
        },
        
        // Clear cache to force reload
        clearCache() {
            cache = null;
        }
    };
})();

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
        
        // Validation state for edit form
        editAliasError: '',
        editTagsError: '',
        isEditValidating: false,
        
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
        
        // Computed property for edit form validity
        get isEditFormValid() {
            return this.editData.alias && 
                   this.editData.tags && 
                   !this.editAliasError && 
                   !this.editTagsError;
        },
        
        // Edit form validation methods
        validateEditAlias() {
            this.editAliasError = '';
            
            if (!this.editData.alias) {
                this.editAliasError = 'Alias is required';
                return;
            }
            
            if (this.editData.alias.length < 2) {
                this.editAliasError = 'Alias must be at least 2 characters';
                return;
            }
            
            if (this.editData.alias.length > 50) {
                this.editAliasError = 'Alias must be less than 50 characters';
                return;
            }
        },
        
        validateEditTags() {
            this.editTagsError = '';
            
            if (!this.editData.tags) {
                this.editTagsError = 'At least one tag is required';
                return;
            }
            
            const tagList = this.editData.tags.split(',').map(t => t.trim()).filter(t => t);
            
            if (tagList.length === 0) {
                this.editTagsError = 'At least one valid tag is required';
                return;
            }
            
            // Check individual tag length
            for (const tag of tagList) {
                if (tag.length > 20) {
                    this.editTagsError = 'Each tag must be less than 20 characters';
                    return;
                }
            }
            
            if (tagList.length > 10) {
                this.editTagsError = 'Maximum 10 tags allowed';
                return;
            }
        },
        
        // Validate all edit fields
        validateEditAll() {
            this.validateEditAlias();
            this.validateEditTags();
        },
        
        async updateWallet() {
            // Final validation before submit
            this.validateEditAll();
            
            if (!this.isEditFormValid) {
                showToast('Please fix validation errors before saving', 'error');
                return;
            }
            
            this.isEditValidating = true;
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
            
            this.isEditValidating = false;
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
        
        // Validation state
        addressError: '',
        aliasError: '',
        tagsError: '',
        isValidating: false,
        
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
        
        // Computed property for form validity
        get isFormValid() {
            return this.address && 
                   this.alias && 
                   this.tags && 
                   !this.addressError && 
                   !this.aliasError && 
                   !this.tagsError;
        },
        
        // Initialize component
        async init() {
            console.log('Initializing wallet form...');
            console.log('API URL:', window.CONFIG?.API_URL);
            console.log('API Key present:', !!window.CONFIG?.API_KEY);
            
            // No need to load wallets for validation - let API handle it
        },
        
        
        // Solana address validation
        validateAddress() {
            this.addressError = '';
            
            if (!this.address) {
                this.addressError = 'Wallet address is required';
                return;
            }
            
            // Trim whitespace
            this.address = this.address.trim();
            
            // Basic Solana address format check (base58, 32-44 chars)
            const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
            if (!solanaAddressRegex.test(this.address)) {
                this.addressError = 'Invalid Solana address format (must be 32-44 base58 characters)';
                return;
            }
            
            // Let API handle duplicate validation
            
            console.log('Address validation passed');
        },
        
        // Alias validation
        validateAlias() {
            this.aliasError = '';
            
            if (!this.alias) {
                this.aliasError = 'Alias is required';
                return;
            }
            
            if (this.alias.length < 2) {
                this.aliasError = 'Alias must be at least 2 characters';
                return;
            }
            
            if (this.alias.length > 50) {
                this.aliasError = 'Alias must be less than 50 characters';
                return;
            }
        },
        
        // Tags validation
        validateTags() {
            this.tagsError = '';
            
            if (!this.tags) {
                this.tagsError = 'At least one tag is required';
                return;
            }
            
            const tagList = this.tags.split(',').map(t => t.trim()).filter(t => t);
            
            if (tagList.length === 0) {
                this.tagsError = 'At least one valid tag is required';
                return;
            }
            
            // Check individual tag length
            for (const tag of tagList) {
                if (tag.length > 20) {
                    this.tagsError = 'Each tag must be less than 20 characters';
                    return;
                }
            }
            
            if (tagList.length > 10) {
                this.tagsError = 'Maximum 10 tags allowed';
                return;
            }
        },
        
        // Validate all fields
        validateAll() {
            this.validateAddress();
            this.validateAlias();
            this.validateTags();
        },
        
        async submitForm() {
            try {
                // Final validation before submit
                this.validateAll();
                
                if (!this.isFormValid) {
                    showToast('Please fix validation errors before submitting', 'error');
                    return;
                }
                
                this.isValidating = true;
                
                // First, fetch the balance for the wallet
                let balanceData = null;
                try {
                    const balanceResponse = await fetch(`${window.CONFIG.API_URL}/api/wallets/${this.address}/balance`, {
                        method: 'POST',
                        headers: {
                            'X-API-Key': window.CONFIG.API_KEY
                        }
                    });
                    
                    if (balanceResponse.ok) {
                        balanceData = await balanceResponse.json();
                        console.log('Balance fetched:', balanceData);
                    } else {
                        console.warn('Failed to fetch balance, continuing without it');
                    }
                } catch (error) {
                    console.warn('Error fetching balance:', error);
                }
                
                // Now create the wallet
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
                    notes: this.notes,
                    // Include balance data if successfully fetched
                    sol_balance: balanceData?.balance || null,
                    last_balance_check: balanceData?.balance ? new Date().toISOString() : null
                })
            });
            
            if (response.ok) {
                const createdWallet = await response.json();
                
                // Close form and reset
                this.showForm = false;
                this.resetForm();
                
                // Use the created wallet directly and update cache
                const newWallet = createdWallet.wallet;
                
                // Update the shared cache with the new wallet
                window.WalletCache.updateWallet(newWallet);
                
                // Add to the wallet list display
                if (window.addNewWalletToList) {
                    window.addNewWalletToList(newWallet);
                } else {
                    // Fallback to refresh if function doesn't exist
                    htmx.trigger('#wallets-table', 'refresh');
                }
                
                // Update existingWallets array for duplicate checking
                this.existingWallets.push(newWallet.address.toLowerCase());
                
                // Show success message with balance if available
                const balanceText = balanceData?.balance !== null ? ` (${balanceData.balance.toFixed(3)} SOL)` : '';
                showToast(`Wallet added: ${newWallet.alias}${balanceText}`, 'success');
            } else {
                const error = await response.json();
                showToast(error.error || 'Failed to add wallet', 'error');
            }
            
            this.isValidating = false;
            } catch (error) {
                console.error('Error in submitForm:', error);
                showToast('An error occurred while submitting the form', 'error');
                this.isValidating = false;
            }
        },
        
        // Reset form to initial state
        resetForm() {
            this.address = '';
            this.alias = '';
            this.tags = '';
            this.twitter_handle = '';
            this.telegram_channel = '';
            this.streaming_channel = '';
            this.image_data = null;
            this.notes = '';
            this.addressError = '';
            this.aliasError = '';
            this.tagsError = '';
            document.getElementById('image_upload').value = '';
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
    
    Alpine.data('uiRefreshConfig', () => {
        return {
            config: {
                balance_interval_minutes: 5,
                auto_refresh_enabled: true,
                pause_on_activity: true,
                show_refresh_indicators: true
            },
        
        // Validation state
        balanceIntervalError: '',
        isLoading: false,
        lastSaved: '',
        nextBalanceRefresh: '',
        
        // Timer for next refresh calculation
        nextRefreshTimer: null,
        
        init() {
            this.loadConfig();
            this.updateNextRefreshDisplay();
        },
        
        loadConfig() {
            const self = this;
            fetch(`${window.CONFIG.API_URL}/api/settings/ui`, {
                headers: {
                    'X-API-Key': window.CONFIG.API_KEY
                }
            })
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Failed to load config');
            })
            .then(data => {
                self.config = data.ui_refresh_config || self.config;
                
                // Notify wallets table about config change
                if (window.updateRefreshConfig) {
                    window.updateRefreshConfig(self.config);
                }
            })
            .catch(error => {
                console.error('Failed to load UI refresh config:', error);
            });
        },
        
        get isFormValid() {
            return this.config.balance_interval_minutes >= 1 && 
                   this.config.balance_interval_minutes <= 60 &&
                   !this.balanceIntervalError;
        },
        
        validateBalanceInterval() {
            this.balanceIntervalError = '';
            
            if (this.config.balance_interval_minutes < 1 || this.config.balance_interval_minutes > 60) {
                this.balanceIntervalError = 'Must be between 1 and 60 minutes';
                return;
            }
        },
        
        validateAll() {
            this.validateBalanceInterval();
        },
        
        updateConfig() {
            this.validateAll();
            
            if (!this.isFormValid) {
                showToast('Please fix validation errors before saving', 'error');
                return;
            }
            
            this.isLoading = true;
            
            const self = this;
            fetch(`${window.CONFIG.API_URL}/api/settings/ui`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': window.CONFIG.API_KEY
                },
                body: JSON.stringify({ ui_refresh_config: this.config })
            })
            .then(response => {
                if (response.ok) {
                    self.lastSaved = new Date().toLocaleTimeString();
                    showToast('UI refresh settings updated', 'success');
                    
                    // Notify wallets table about config change
                    if (window.updateRefreshConfig) {
                        window.updateRefreshConfig(self.config);
                    }
                    
                    self.updateNextRefreshDisplay();
                } else {
                    return response.json().then(error => {
                        showToast(error.error || 'Failed to update settings', 'error');
                    });
                }
            })
            .catch(error => {
                console.error('Failed to update config:', error);
                showToast('Failed to update settings', 'error');
            })
            .finally(() => {
                self.isLoading = false;
            });
        },
        
        resetDefaults() {
            this.config = {
                balance_interval_minutes: 5,
                auto_refresh_enabled: true,
                pause_on_activity: true,
                show_refresh_indicators: true
            };
            this.updateConfig();
        },
        
        updateNextRefreshDisplay() {
            if (this.nextRefreshTimer) {
                clearInterval(this.nextRefreshTimer);
            }
            
            if (!this.config.auto_refresh_enabled) {
                this.nextBalanceRefresh = 'Auto-refresh disabled';
                return;
            }
            
            // Calculate next refresh time
            const nextRefresh = new Date();
            nextRefresh.setMinutes(nextRefresh.getMinutes() + this.config.balance_interval_minutes);
            
            const updateDisplay = () => {
                const now = new Date();
                const diff = nextRefresh - now;
                
                if (diff <= 0) {
                    this.nextBalanceRefresh = 'Refreshing now...';
                    return;
                }
                
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                
                if (minutes > 0) {
                    this.nextBalanceRefresh = `${minutes}m ${seconds}s`;
                } else {
                    this.nextBalanceRefresh = `${seconds}s`;
                }
            };
            
            updateDisplay();
            this.nextRefreshTimer = setInterval(updateDisplay, 1000);
        }
    }});
    
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