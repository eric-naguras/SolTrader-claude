export const settingsPage = () => /*html*/ `<section>
    <h1>Settings</h1>
    
    <!-- Tab Navigation -->
    <nav>
        <ul role="tablist">
            <li><a href="#logging" role="tab" aria-selected="true" onclick="switchTab('logging')">Logging Configuration</a></li>
            <li><a href="#ui-refresh" role="tab" aria-selected="false" onclick="switchTab('ui-refresh')">UI Refresh Settings</a></li>
            <li><a href="#services" role="tab" aria-selected="false" onclick="switchTab('services')">Service Management</a></li>
            <li><a href="#general" role="tab" aria-selected="false" onclick="switchTab('general')">General Settings</a></li>
        </ul>
    </nav>
    
    <!-- Logging Tab -->
    <div id="logging-tab" role="tabpanel">
        <h2>Whale Watcher Logging</h2>
        <p>Configure which events are logged to the console. Changes take effect immediately.</p>
        
        <div id="logging-config" hx-get="/htmx/logging-config" hx-trigger="load">
            <article aria-busy="true">Loading configuration...</article>
        </div>
        
        <div id="toast-container"></div>
    </div>
    
    <!-- UI Refresh Settings Tab -->
    <div id="ui-refresh-tab" role="tabpanel" style="display: none;">
        <h2>UI Refresh Settings</h2>
        <p>Configure how often the wallet balances and age information are automatically updated.</p>
        
        <div id="ui-settings-form" hx-get="/htmx/settings/ui" hx-trigger="load">
            <article aria-busy="true">Loading UI settings...</article>
        </div>
        
        <div id="toast-container"></div>
    </div>
    
    <!-- Service Management Tab -->
    <div id="services-tab" role="tabpanel" style="display: none;">
        <h2>Service Management</h2>
        <p>Start or stop individual services. Service states are persisted across server restarts.</p>
        
        <div id="service-controls" hx-get="/htmx/service-controls" hx-trigger="load">
            <article aria-busy="true">Loading service status...</article>
        </div>
        
        <div id="toast-container"></div>
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
    document.getElementById('services-tab').style.display = 'none';
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