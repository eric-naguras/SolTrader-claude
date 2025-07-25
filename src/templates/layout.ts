export const layout = (content: string) => /*html*/ `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sonar Platform</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
    <link rel="stylesheet" href="/css/app.css">
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    <script src="https://unpkg.com/alpinejs@3.13.5/dist/cdn.min.js" defer></script>
    <script src="/js/config.js"></script>
    <style>
        /* Toggle Switch Styles */
        .switch {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            cursor: pointer;
            font-weight: 500;
            color: var(--pico-color);
            user-select: none;
            padding: 0.5rem 0;
        }

        .switch input[type="checkbox"] {
            position: absolute;
            opacity: 0;
            width: 0;
            height: 0;
        }

        .switch .slider {
            position: relative;
            width: 50px;
            height: 30px;
            background: var(--pico-muted-border-color);
            border-radius: 9999px;
            border: 2px solid var(--pico-border-color);
            transition: background 0.3s, border-color 0.3s;
            flex-shrink: 0;
        }

        .switch .slider::before {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 24px;
            height: 24px;
            background: white;
            border-radius: 9999px;
            transition: transform 0.3s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        /* Checked (ON) state */
        .switch input:checked + .slider {
            background: #4c9aff;
            border-color: #4c9aff;
        }

        .switch input:checked + .slider::before {
            transform: translateX(20px);
        }

        /* Focus & hover effects */
        .switch input:focus-visible + .slider {
            outline: 2px solid #4c9aff;
            outline-offset: 2px;
        }

        .switch:hover .slider {
            border-color: #4c9aff;
        }

        /* Label styling */
        .switch .label {
            display: block;
        }

        .switch .label strong {
            font-weight: 600;
        }

        .switch .label small {
            font-size: 0.875rem;
            line-height: 1.2;
        }
    </style>
</head>
<body>
    <nav class="container-fluid">
        <ul>
            <li><strong>Sonar Platform</strong></li>
        </ul>
        <ul>
            <li><a href="/" hx-get="/htmx/dashboard" hx-target="#main-content" hx-push-url="/" class="nav-link" data-page="dashboard">Dashboard</a></li>
            <li><a href="/wallets" hx-get="/htmx/wallets" hx-target="#main-content" hx-push-url="/wallets" class="nav-link" data-page="wallets">Wallets</a></li>
            <li><a href="/trades" hx-get="/htmx/trades" hx-target="#main-content" hx-push-url="/trades" class="nav-link" data-page="trades">Trades</a></li>
            <li><a href="/settings" hx-get="/htmx/settings" hx-target="#main-content" hx-push-url="/settings" class="nav-link" data-page="settings">Settings</a></li>
        </ul>
    </nav>

    <main class="container-fluid" id="main-content">
        ${content}
    </main>


    <script src="/js/app.js"></script>
</body>
</html>`;

export const layoutWithInitialLoad = () => layout(`
        <!-- Initial load dashboard -->
        <div hx-get="/htmx/dashboard" hx-trigger="load" hx-swap="outerHTML">
            <article aria-busy="true">Loading...</article>
        </div>
`);