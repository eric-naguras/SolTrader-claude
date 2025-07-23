export const loggingConfigPartial = () => `<div 
    hx-get="/htmx/logging-config" 
    hx-trigger="load" 
    hx-swap="outerHTML"
    id="logging-config-container">
    <article>
        <header>
            <h3>Log Categories</h3>
            <p>Toggle which events appear in the console logs</p>
        </header>
        
        <form hx-put="/htmx/logging-config" hx-trigger="change" hx-target="#toast-container">
            <div class="grid">
                <!-- Connection Events -->
                <div>
                    <label>
                        <input type="checkbox" name="connection" role="switch">
                        <strong>🔌 Connection Events</strong>
                        <br>
                        <small>WebSocket connections, disconnections, reconnects</small>
                    </label>
                </div>
                
                <!-- Wallet Activity -->
                <div>
                    <label>
                        <input type="checkbox" name="wallet" role="switch">
                        <strong>👛 Wallet Activity</strong>
                        <br>
                        <small>Wallet loading, tracking changes</small>
                    </label>
                </div>
                
                <!-- Trade Detection -->
                <div>
                    <label>
                        <input type="checkbox" name="trade" role="switch">
                        <strong>📊 Trade Detection</strong>
                        <br>
                        <small>Entry/exit trades, amounts, tokens</small>
                    </label>
                </div>
                
                <!-- Multi-Whale Coordination -->
                <div>
                    <label>
                        <input type="checkbox" name="multiWhale" role="switch">
                        <strong>🎯 Multi-Whale Alerts</strong>
                        <br>
                        <small>Multiple whales in same token</small>
                    </label>
                </div>
                
                <!-- Transaction Processing -->
                <div>
                    <label>
                        <input type="checkbox" name="transaction" role="switch">
                        <strong>💾 Transaction Processing</strong>
                        <br>
                        <small>Raw transaction details, parsing</small>
                    </label>
                </div>
                
                <!-- Data Flow -->
                <div>
                    <label>
                        <input type="checkbox" name="dataFlow" role="switch">
                        <strong>📡 Data Flow</strong>
                        <br>
                        <small>WebSocket messages, queue status</small>
                    </label>
                </div>
                
                <!-- Health Monitoring -->
                <div>
                    <label>
                        <input type="checkbox" name="health" role="switch">
                        <strong>❤️ Health & Performance</strong>
                        <br>
                        <small>Heartbeats, latency, memory usage</small>
                    </label>
                </div>
                
                <!-- Debug Information -->
                <div>
                    <label>
                        <input type="checkbox" name="debug" role="switch">
                        <strong>🐛 Debug Information</strong>
                        <br>
                        <small>Detailed errors, raw data, state changes</small>
                    </label>
                </div>
            </div>
            
            <footer>
                <div class="grid">
                    <button type="button" class="secondary" disabled>Save as Preset (Coming Soon)</button>
                    <button type="button" class="outline" onclick="location.reload()">Reset to Defaults</button>
                </div>
            </footer>
        </form>
    </article>
</div>

<div id="toast-container"></div>`;