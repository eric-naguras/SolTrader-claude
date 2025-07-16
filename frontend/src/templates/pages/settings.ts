export const settingsPage = () => `<section>
    <h1>Settings</h1>
    
    <!-- Tab Navigation -->
    <nav>
        <ul role="tablist">
            <li><a href="#logging" role="tab" aria-selected="true" onclick="switchTab('logging')">Logging Configuration</a></li>
            <li><a href="#ui-refresh" role="tab" aria-selected="false" onclick="switchTab('ui-refresh')">UI Refresh Settings</a></li>
            <li><a href="#general" role="tab" aria-selected="false" onclick="switchTab('general')">General Settings</a></li>
        </ul>
    </nav>
    
    <!-- Logging Tab -->
    <div id="logging-tab" role="tabpanel">
        <h2>Whale Watcher Logging</h2>
        <p>Configure which events are logged to the console. Changes take effect immediately.</p>
        
        <div id="logging-config" hx-get="/htmx/partials/logging-config" hx-trigger="load">
            <article aria-busy="true">Loading configuration...</article>
        </div>
    </div>
    
    <!-- UI Refresh Settings Tab -->
    <div id="ui-refresh-tab" role="tabpanel" style="display: none;">
        <h2>UI Refresh Settings</h2>
        <p>Configure how often the wallet balances and age information are automatically updated.</p>
        
        <div x-data="uiRefreshConfig" x-init="init()">
            <form @submit.prevent="updateConfig">
                <div>
                    <label for="balance-interval">
                        Balance Refresh Interval (minutes)
                        <input type="number" id="balance-interval" 
                               x-model="config.balance_interval_minutes" 
                               min="1" max="60" required
                               @input="validateBalanceInterval()"
                               :class="{ 'validation-error': balanceIntervalError }">
                        <small x-show="balanceIntervalError" x-text="balanceIntervalError" class="error-text"></small>
                        <small>How often to check wallet balances (1-60 minutes). Age display updates automatically every second.</small>
                    </label>
                </div>
                
                <div class="grid">
                    <div>
                        <label>
                            <input type="checkbox" x-model="config.auto_refresh_enabled" role="switch">
                            Enable Auto-Refresh
                        </label>
                        <small>Automatically refresh balances and age information</small>
                    </div>
                    <div>
                        <label>
                            <input type="checkbox" x-model="config.pause_on_activity" role="switch">
                            Pause on User Activity
                        </label>
                        <small>Pause auto-refresh when user is interacting with the page</small>
                    </div>
                </div>
                
                <div>
                    <label>
                        <input type="checkbox" x-model="config.show_refresh_indicators" role="switch">
                        Show Refresh Indicators
                    </label>
                    <small>Display loading indicators during refresh operations</small>
                </div>
                
                <div class="grid">
                    <button type="submit" :disabled="!isFormValid" :class="{ 'disabled': !isFormValid }">
                        <span x-show="!isLoading">Save Settings</span>
                        <span x-show="isLoading">Saving...</span>
                    </button>
                    <button type="button" @click="resetDefaults" class="secondary">
                        Reset to Defaults
                    </button>
                </div>
                
                <div x-show="lastSaved" class="success-message">
                    <small>Settings saved at <span x-text="lastSaved"></span></small>
                </div>
                
                <div x-show="nextBalanceRefresh" class="info-message">
                    <small>Next balance refresh: <span x-text="nextBalanceRefresh"></span></small>
                </div>
            </form>
        </div>
    </div>
    
    <!-- General Tab (placeholder for future settings) -->
    <div id="general-tab" role="tabpanel" style="display: none;">
        <h2>General Settings</h2>
        <p>Additional settings will be available here in future updates.</p>
    </div>
</section>

<script>
function switchTab(tab) {
    // Hide all tabs
    document.getElementById('logging-tab').style.display = 'none';
    document.getElementById('ui-refresh-tab').style.display = 'none';
    document.getElementById('general-tab').style.display = 'none';
    
    // Show selected tab
    document.getElementById(\`\${tab}-tab\`).style.display = 'block';
    
    // Update aria-selected
    document.querySelectorAll('[role="tab"]').forEach(t => {
        t.setAttribute('aria-selected', 'false');
    });
    event.target.setAttribute('aria-selected', 'true');
}
</script>`;