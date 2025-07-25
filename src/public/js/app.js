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

// Vanilla EventSource for SSE - following CLAUDE.md architecture rules
let evtSource = null;

function initializeSSE() {
    console.log('[SSE] Initializing EventSource connection...');
    
    evtSource = new EventSource('/events');
    
    evtSource.addEventListener('open', () => {
        console.log('[SSE] Connection opened');
    });
    
    evtSource.addEventListener('error', (e) => {
        console.error('[SSE] Connection error:', e);
        if (evtSource.readyState === EventSource.CLOSED) {
            console.log('[SSE] Connection closed, attempting to reconnect in 5 seconds...');
            setTimeout(initializeSSE, 5000);
        }
    });
    
    evtSource.addEventListener('connected', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Connected at:', data.timestamp);
    });
    
    evtSource.addEventListener('heartbeat', (e) => {
        console.log('[SSE] Heartbeat received');
    });
    
    evtSource.addEventListener('new_trade', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] New trade event:', data);
        
        // Update trade feed if on dashboard
        const tradeFeed = document.getElementById('trade-feed');
        if (tradeFeed) {
            htmx.trigger('#trade-feed > div', 'load');
        }
        
        // Update trades table if on trades page
        const tradesTable = document.getElementById('trades-table');
        if (tradesTable) {
            htmx.trigger('#trades-table', 'load');
        }
    });
    
    evtSource.addEventListener('new_signal', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] New signal event:', data);
        
        // Show notification
        showToast(`New signal: ${data.signal.coin_address}`, 'success');
        
        // Update signals if on dashboard
        const signalsList = document.getElementById('signals-list');
        if (signalsList) {
            htmx.trigger('#signals-list > div', 'load');
        }
    });
    
    evtSource.addEventListener('stats_updated', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Stats updated event:', data);
        
        // Update dashboard stats
        const dashboardStats = document.getElementById('dashboard-stats');
        if (dashboardStats) {
            htmx.trigger('#dashboard-stats', 'refresh');
        }
    });
}

// Initialize SSE when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeSSE();
});

// Clean up SSE connection when page unloads
window.addEventListener('beforeunload', () => {
    if (evtSource) {
        evtSource.close();
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
        
        closeModal() {
            const modal = document.getElementById('edit-wallet-modal');
            if (modal) {
                modal.close();
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
        
        submitForm() {
            try {
                // Final validation before submit
                this.validateAll();
                
                if (!this.isFormValid) {
                    showToast('Please fix validation errors before submitting', 'error');
                    return;
                }
                
                this.isValidating = true;
                
                // Use HTMX to submit the form
                const form = document.getElementById('wallet-form');
                if (form) {
                    htmx.trigger(form, 'submit');
                    // Reset form after successful submission will be handled by HTMX response
                    this.showForm = false;
                    this.resetForm();
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
    
    // Logging config is now handled by HTMX, no Alpine.js needed
    
    // UI settings are now handled by HTMX, no Alpine.js needed
    
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
            const checkedTags = Array.from(interactiveCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            
            // Set selected tags based on what's actually checked
            // The server renders checkboxes as checked based on the current filter state
            if (checkedTags.length === this.allTags.length) {
                // All tags are checked = all selected
                this.selectedTags = [...this.allTags];
            } else if (checkedTags.length === 0) {
                // No tags are checked = none selected  
                this.selectedTags = [];
            } else {
                // Some tags are checked = partial selection
                this.selectedTags = checkedTags;
            }
            
            // Initialize applied tags to match selected tags (this represents the current server state)
            this.appliedTags = [...this.selectedTags];
            
            console.log('[TagFilter] Initialized:', {
                allTags: this.allTags,
                checkedTags: checkedTags,
                selectedTags: this.selectedTags,
                appliedTags: this.appliedTags
            });
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
            
            // Debug logging
            console.log('[TagFilter] Applying filters:', {
                selectedTags: this.selectedTags,
                allTags: this.allTags,
                selectedCount: this.selectedTags.length,
                allCount: this.allTags.length
            });
            
            // Handle tag filtering logic
            if (this.selectedTags.length === 0) {
                // No tags selected = show no wallets (send empty string)
                urlParams.set('tags', '');
                console.log('[TagFilter] No tags selected, sending empty string');
            } else if (this.selectedTags.length === this.allTags.length) {
                // All tags selected = show all wallets (don't send tags parameter)
                // Don't set tags parameter, server will default to showing all
                console.log('[TagFilter] All tags selected, not sending tags parameter');
            } else {
                // Some tags selected = filter by selected tags
                urlParams.set('tags', this.selectedTags.join(','));
                console.log('[TagFilter] Some tags selected:', this.selectedTags.join(','));
            }
            
            const finalUrl = `/htmx/partials/wallets-table?${urlParams.toString()}`;
            console.log('[TagFilter] Final URL:', finalUrl);
            
            // Use htmx.ajax directly to ensure the request is made with correct parameters
            htmx.ajax('GET', finalUrl, {
                target: '#wallets-table',
                swap: 'innerHTML'
            });
            
            // Update the browser URL for persistence (only if we're on the wallets page)
            if (window.location.pathname === '/wallets') {
                const pageUrl = `/wallets${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
                window.history.replaceState(null, '', pageUrl);
                console.log('[TagFilter] Updated URL:', pageUrl);
            }
            
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
            
            const response = await fetch(`/api/trades/${id}/close`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-API-Key': window.CONFIG?.API_KEY || 'test-api-key'
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
    
    // Set the form action URL
    const editForm = document.getElementById('edit-wallet-form');
    if (editForm) {
        editForm.setAttribute('hx-put', `/htmx/wallets/${address}`);
    }
    
    // Open modal
    modal.showModal();
};

// Delete wallet function
window.deleteWallet = function(address) {
    if (!confirm('Are you sure you want to delete this wallet?')) {
        return;
    }
    
    // Use HTMX to send delete request
    htmx.ajax('DELETE', `/htmx/wallets/${address}`, {
        target: '#toast-container'
    });
};