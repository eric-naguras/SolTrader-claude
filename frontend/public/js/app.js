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
                method: 'PUT',
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
            
            // Note: Duplicate validation is handled by API on submission
            
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
                
                // Skip balance fetching for now - endpoint doesn't exist
                // Balance will be fetched later by background services
                console.log('Creating wallet without initial balance fetch');
                
                // Create the wallet
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
                    // Balance will be fetched later by background services
                    sol_balance: null,
                    last_balance_check: null,
                    // Set wallet as active by default
                    is_active: true
                })
            });
            
            if (response.ok) {
                const createdWallet = await response.json();
                
                // Close form and reset
                this.showForm = false;
                this.resetForm();
                
                // Use the created wallet directly
                const newWallet = createdWallet.wallet;
                
                // Refresh the wallets table to show the new wallet
                htmx.trigger('#wallets-table', 'refresh');
                
                // Show success message
                showToast(`Wallet added: ${newWallet.alias}`, 'success');
            } else {
                const error = await response.json();
                
                // Handle duplicate address error specially
                if (response.status === 409) {
                    this.addressError = error.error || 'This wallet address already exists';
                    showToast(error.error || 'Wallet address already exists', 'error');
                } else {
                    showToast(error.error || 'Failed to add wallet', 'error');
                }
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
    
    Alpine.data('tagFilter', () => ({
        showPreview: false,
        showFilter: false,
        selectedTags: [],
        allTags: [],
        appliedTags: [], // Track what tags are currently applied
        
        init() {
            // Extract all available tags from the interactive filter only (not preview)
            const interactiveCheckboxes = this.$el.querySelectorAll('.tag-filter-popup.interactive .tag-filter-content input[type="checkbox"]');
            this.allTags = Array.from(interactiveCheckboxes).map(cb => cb.value).filter(Boolean);
            
            // Initialize selected tags based on initially checked checkboxes
            // If all are checked (or none specified), we have all selected
            const checkedTags = Array.from(interactiveCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            
            // If all tags are checked or no specific selection, select all
            if (checkedTags.length === this.allTags.length || checkedTags.length === 0) {
                this.selectedTags = [...this.allTags];
            } else {
                this.selectedTags = checkedTags;
            }
            
            // Initialize applied tags to match selected tags
            this.appliedTags = [...this.selectedTags];
        },
        
        toggleTag(tag) {
            const index = this.selectedTags.indexOf(tag);
            if (index > -1) {
                this.selectedTags.splice(index, 1);
            } else {
                this.selectedTags.push(tag);
            }
            // Don't apply filters immediately - wait for click outside
        },
        
        selectAll() {
            this.selectedTags = [...this.allTags];
            // Don't apply filters immediately - wait for click outside
        },
        
        clearAll() {
            this.selectedTags = [];
            // Don't apply filters immediately - wait for click outside
        },
        
        applyFilters() {
            // Get current sort parameters from the table
            const table = document.querySelector('#wallets-table table');
            const urlParams = new URLSearchParams();
            
            // Find the current sort column and order
            let currentSortBy = 'created_at';
            let currentSortOrder = 'desc';
            
            // Look for the active sort header (has the active sort icon)
            const activeSortHeader = table?.querySelector('th .sort-icon.active');
            if (activeSortHeader) {
                const th = activeSortHeader.closest('th');
                const hxGet = th?.getAttribute('hx-get');
                if (hxGet) {
                    const sortParams = new URLSearchParams(hxGet.split('?')[1]);
                    currentSortBy = sortParams.get('sortBy') || currentSortBy;
                    // The current order is the opposite of what's in the link (since links toggle)
                    const linkOrder = sortParams.get('sortOrder');
                    currentSortOrder = linkOrder === 'asc' ? 'desc' : 'asc';
                }
            }
            
            // Set the current sort parameters
            urlParams.set('sortBy', currentSortBy);
            urlParams.set('sortOrder', currentSortOrder);
            
            // Add selected tags only if not all tags are selected
            // If all tags are selected, don't send tags parameter (server will default to showing all)
            if (this.selectedTags.length > 0 && this.selectedTags.length < this.allTags.length) {
                urlParams.set('tags', this.selectedTags.join(','));
            } else if (this.selectedTags.length === 0) {
                // Explicitly set empty to show no wallets
                urlParams.set('tags', '');
            }
            // If selectedTags.length === allTags.length, don't set tags parameter (show all)
            
            // Trigger HTMX request to reload table with filters
            htmx.ajax('GET', `/htmx/partials/wallets-table?${urlParams.toString()}`, {
                target: '#wallets-table',
                swap: 'innerHTML'
            });
            
            // Update applied tags to match current selection
            this.appliedTags = [...this.selectedTags];
        },
        
        cancelFilters() {
            // Revert selected tags to last applied state
            this.selectedTags = [...this.appliedTags];
        }
    })),
    
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
    // Find the wallet row by ID
    const walletRow = document.querySelector(`#wallet-row-${address}`);
    if (!walletRow) {
        showToast('Wallet data not found', 'error');
        return;
    }
    
    // Get Alpine component
    const modal = document.getElementById('edit-wallet-modal');
    const alpineComponent = Alpine.$data(modal.querySelector('[x-data]'));
    
    // Read data from attributes
    alpineComponent.editData = {
        address: address,
        alias: walletRow.dataset.walletAlias || '',
        tags: walletRow.dataset.walletTags || '',
        ui_color: walletRow.dataset.walletColor || '#4338ca',
        twitter_handle: walletRow.dataset.walletTwitter || '',
        telegram_channel: walletRow.dataset.walletTelegram || '',
        streaming_channel: walletRow.dataset.walletStreaming || '',
        image_data: walletRow.dataset.walletImage || null,
        notes: walletRow.dataset.walletNotes || '',
        is_active: walletRow.dataset.walletActive === 'true'
    };
    
    // Clear file input
    const fileInput = document.getElementById('edit-image');
    if (fileInput) fileInput.value = '';
    
    // Open modal
    modal.showModal();
};

// Delete wallet function
window.deleteWallet = async function(address) {
    if (!confirm('Are you sure you want to delete this wallet?')) {
        return;
    }
    
    try {
        const response = await fetch(`${window.CONFIG.API_URL}/api/wallets/${address}`, {
            method: 'DELETE',
            headers: {
                'X-API-Key': window.CONFIG.API_KEY
            }
        });
        
        if (response.ok) {
            // Refresh the wallets table
            htmx.trigger('#wallets-table', 'refresh');
            showToast('Wallet deleted successfully', 'success');
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to delete wallet', 'error');
        }
    } catch (error) {
        console.error('Error deleting wallet:', error);
        showToast('Failed to delete wallet', 'error');
    }
};