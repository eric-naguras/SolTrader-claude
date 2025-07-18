export const loggingConfigPartial = () => `<div x-data="loggingConfig">
    <article>
        <header>
            <h3>Log Categories</h3>
            <p>Toggle which events appear in the console logs</p>
        </header>
        
        <div class="grid">
            <!-- Connection Events -->
            <div>
                <label>
                    <input type="checkbox" 
                           x-model="config.connection" 
                           @change="updateConfig"
                           role="switch">
                    <strong>🔌 Connection Events</strong>
                    <br>
                    <small>WebSocket connections, disconnections, reconnects</small>
                </label>
            </div>
            
            <!-- Wallet Activity -->
            <div>
                <label>
                    <input type="checkbox" 
                           x-model="config.wallet" 
                           @change="updateConfig"
                           role="switch">
                    <strong>👛 Wallet Activity</strong>
                    <br>
                    <small>Wallet loading, tracking changes</small>
                </label>
            </div>
            
            <!-- Trade Detection -->
            <div>
                <label>
                    <input type="checkbox" 
                           x-model="config.trade" 
                           @change="updateConfig"
                           role="switch">
                    <strong>📊 Trade Detection</strong>
                    <br>
                    <small>Entry/exit trades, amounts, tokens</small>
                </label>
            </div>
            
            <!-- Multi-Whale Coordination -->
            <div>
                <label>
                    <input type="checkbox" 
                           x-model="config.multiWhale" 
                           @change="updateConfig"
                           role="switch">
                    <strong>🎯 Multi-Whale Alerts</strong>
                    <br>
                    <small>Multiple whales in same token</small>
                </label>
            </div>
            
            <!-- Transaction Processing -->
            <div>
                <label>
                    <input type="checkbox" 
                           x-model="config.transaction" 
                           @change="updateConfig"
                           role="switch">
                    <strong>💾 Transaction Processing</strong>
                    <br>
                    <small>Raw transaction details, parsing</small>
                </label>
            </div>
            
            <!-- Data Flow -->
            <div>
                <label>
                    <input type="checkbox" 
                           x-model="config.dataFlow" 
                           @change="updateConfig"
                           role="switch">
                    <strong>📡 Data Flow</strong>
                    <br>
                    <small>WebSocket messages, queue status</small>
                </label>
            </div>
            
            <!-- Health Monitoring -->
            <div>
                <label>
                    <input type="checkbox" 
                           x-model="config.health" 
                           @change="updateConfig"
                           role="switch">
                    <strong>❤️ Health & Performance</strong>
                    <br>
                    <small>Heartbeats, latency, memory usage</small>
                </label>
            </div>
            
            <!-- Debug Information -->
            <div>
                <label>
                    <input type="checkbox" 
                           x-model="config.debug" 
                           @change="updateConfig"
                           role="switch">
                    <strong>🐛 Debug Information</strong>
                    <br>
                    <small>Detailed errors, raw data, state changes</small>
                </label>
            </div>
        </div>
        
        <footer>
            <div class="grid">
                <button @click="savePreset" class="secondary">Save as Preset</button>
                <button @click="resetDefaults" class="outline">Reset to Defaults</button>
            </div>
            <small x-show="lastSaved" x-text="\`Last saved: \${lastSaved}\`"></small>
        </footer>
    </article>
</div>`;