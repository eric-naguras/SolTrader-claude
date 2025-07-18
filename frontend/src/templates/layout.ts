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