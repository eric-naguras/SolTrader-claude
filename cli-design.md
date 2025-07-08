# CLI Tool Design Specifications

## Overview

The Sonar CLI provides a command-line interface for managing and interacting with the Project Sonar platform. It follows a modular design with sub-commands for different functionalities.

## Command Structure

```
sonar [global-options] <command> [command-options] [arguments]
```

## Global Options

```bash
--config, -c <path>     Path to configuration file (default: ~/.sonar/config.json)
--profile, -p <name>    Configuration profile to use (default: default)
--api-url <url>         Override API endpoint URL
--api-key <key>         Override API key
--output, -o <format>   Output format: json, table, csv (default: table)
--quiet, -q             Suppress non-essential output
--verbose, -v           Enable verbose output
--debug, -d             Enable debug output
--no-color              Disable colored output
--help, -h              Show help
--version               Show version
```

## Commands

### 1. Wallet Management

#### `sonar wallet`
Manage tracked whale wallets.

```bash
# List all wallets
sonar wallet list [options]
  --active              Show only active wallets
  --inactive            Show only inactive wallets
  --tags <tags>         Filter by tags (comma-separated)
  --sort <field>        Sort by: alias, address, created (default: alias)
  --limit <n>           Limit results (default: 50)
  --format <fmt>        Output format: table, json, csv (default: table)

# Add a new wallet
sonar wallet add <address> [options]
  --alias <name>        Set wallet alias
  --tags <tags>         Add tags (comma-separated)
  --inactive            Add as inactive (default: active)
  --metadata <json>     Add custom metadata as JSON

# Get wallet details
sonar wallet get <address> [options]
  --trades              Include recent trades
  --stats               Include wallet statistics

# Update wallet
sonar wallet update <address> [options]
  --alias <name>        Update alias
  --add-tags <tags>     Add tags (comma-separated)
  --remove-tags <tags>  Remove tags (comma-separated)
  --active              Set as active
  --inactive            Set as inactive
  --metadata <json>     Update metadata

# Remove wallet
sonar wallet remove <address> [options]
  --force, -f           Skip confirmation prompt

# Import wallets from file
sonar wallet import <file> [options]
  --format <fmt>        File format: csv, json (auto-detect if not specified)
  --dry-run             Preview import without making changes

# Export wallets
sonar wallet export [options]
  --format <fmt>        Export format: csv, json (default: json)
  --output <file>       Output file (default: stdout)

# Wallet statistics
sonar wallet stats [address] [options]
  --period <period>     Time period: 24h, 7d, 30d, all (default: 7d)
  --metric <metric>     Specific metric: trades, volume, pnl
```

### 2. Signal Management

#### `sonar signal`
View and manage trade signals.

```bash
# List signals
sonar signal list [options]
  --status <status>     Filter by status: open, executed, expired
  --token <address>     Filter by token address
  --since <datetime>    Show signals since date/time
  --until <datetime>    Show signals until date/time
  --min-whales <n>      Minimum whale count
  --limit <n>           Limit results (default: 20)
  --watch, -w           Watch for new signals in real-time

# Get signal details
sonar signal get <signal-id> [options]
  --trades              Show triggering trades
  --whales              Show involved wallets

# Signal statistics
sonar signal stats [options]
  --period <period>     Time period: 24h, 7d, 30d, all (default: 7d)
  --by-token            Group statistics by token
  --by-rule             Group statistics by rule

# Test signal generation
sonar signal test [options]
  --rule <rule-id>      Test specific rule
  --dry-run             Show what would trigger without creating signal
```

### 3. Portfolio Management

#### `sonar portfolio`
Manage paper trading portfolio.

```bash
# Show portfolio summary
sonar portfolio summary [options]
  --detailed            Show detailed breakdown

# List trades
sonar portfolio trades [options]
  --status <status>     Filter by status: open, closed
  --token <address>     Filter by token
  --signal <id>         Filter by signal ID
  --since <datetime>    Show trades since date/time
  --sort <field>        Sort by: created, pnl, status
  --limit <n>           Limit results (default: 50)

# Get trade details
sonar portfolio trade <trade-id> [options]
  --history             Show price history

# Close trade manually
sonar portfolio close <trade-id> [options]
  --reason <reason>     Close reason
  --notes <notes>       Additional notes

# Performance report
sonar portfolio performance [options]
  --period <period>     Time period: 24h, 7d, 30d, all
  --by-day              Daily breakdown
  --by-token            Group by token
  --export <file>       Export to file

# P&L report
sonar portfolio pnl [options]
  --realized            Show only realized P&L
  --unrealized          Show only unrealized P&L
  --by-token            Group by token
  --by-signal           Group by signal
```

### 4. Configuration Management

#### `sonar config`
Manage system configuration.

```bash
# Show current configuration
sonar config show [options]
  --secrets             Include sensitive values

# Set configuration value
sonar config set <key> <value> [options]
  --profile <name>      Set for specific profile

# Get configuration value
sonar config get <key> [options]
  --profile <name>      Get from specific profile

# Manage profiles
sonar config profile list
sonar config profile create <name>
sonar config profile delete <name>
sonar config profile copy <source> <dest>

# Manage signal rules
sonar config rules list
sonar config rules add [options]
  --name <name>         Rule name
  --min-whales <n>      Minimum whales (default: 3)
  --window <hours>      Time window in hours (default: 1)
  --min-sol <amount>    Minimum SOL amount (default: 10)
  --inactive            Create as inactive

sonar config rules update <rule-id> [options]
  --name <name>         Update rule name
  --min-whales <n>      Update minimum whales
  --window <hours>      Update time window
  --min-sol <amount>    Update minimum SOL
  --active              Activate rule
  --inactive            Deactivate rule

sonar config rules delete <rule-id>

# Test configuration
sonar config test [options]
  --api                 Test API connection
  --database            Test database connection
  --websocket           Test WebSocket connection
  --notifications       Test notification channels
```

### 5. Service Management

#### `sonar service`
Manage background services.

```bash
# Show service status
sonar service status [service-name]

# Start services
sonar service start [service-name] [options]
  --all                 Start all services
  --daemon, -d          Run as daemon
  --log-file <file>     Log output to file

# Stop services
sonar service stop [service-name] [options]
  --all                 Stop all services
  --force               Force stop

# Restart services
sonar service restart [service-name] [options]
  --all                 Restart all services

# View logs
sonar service logs [service-name] [options]
  --follow, -f          Follow log output
  --tail <n>            Show last n lines (default: 100)
  --since <datetime>    Show logs since date/time
  --level <level>       Filter by log level: debug, info, warn, error

# Service health check
sonar service health [service-name]
```

### 6. Monitoring Commands

#### `sonar monitor`
Real-time monitoring commands.

```bash
# Monitor whale trades
sonar monitor trades [options]
  --wallet <address>    Filter by wallet
  --token <address>     Filter by token
  --min-value <sol>     Minimum trade value

# Monitor signals
sonar monitor signals [options]
  --sound               Play sound on new signal
  --notification        Send desktop notification

# Monitor portfolio
sonar monitor portfolio [options]
  --interval <seconds>  Update interval (default: 5)

# System metrics
sonar monitor metrics [options]
  --service <name>      Show metrics for specific service
```

### 7. Utility Commands

#### `sonar utils`
Utility commands for maintenance and debugging.

```bash
# Database utilities
sonar utils db migrate              Run database migrations
sonar utils db seed                 Seed test data
sonar utils db backup <file>         Backup database
sonar utils db restore <file>        Restore database

# Cache utilities
sonar utils cache clear              Clear all caches
sonar utils cache stats              Show cache statistics

# Token lookup
sonar utils token <address>          Get token information

# Wallet analysis
sonar utils analyze <address>        Analyze wallet trading patterns

# Export data
sonar utils export trades <file>     Export trade history
sonar utils export signals <file>    Export signal history

# System diagnostics
sonar utils diagnose                 Run system diagnostics
```

## Interactive Mode

```bash
# Start interactive shell
sonar shell

# Interactive shell commands
> wallet list --active
> signal watch
> portfolio summary
> help
> exit
```

## Configuration File Format

```json
{
  "profiles": {
    "default": {
      "api": {
        "url": "http://localhost:3000/api/v1",
        "key": "your-api-key"
      },
      "database": {
        "url": "postgresql://user:pass@localhost:5432/sonar"
      },
      "notifications": {
        "telegram": {
          "enabled": true,
          "bot_token": "your-bot-token",
          "chat_ids": ["chat-id-1", "chat-id-2"]
        },
        "discord": {
          "enabled": false,
          "webhook_url": "https://discord.com/api/webhooks/..."
        }
      },
      "trading": {
        "paper_trade_size": 1.0,
        "slippage_bps": 100
      },
      "output": {
        "format": "table",
        "color": true,
        "timezone": "UTC"
      }
    },
    "production": {
      // Production configuration
    }
  }
}
```

## Output Formats

### Table Format (Default)
```
┌─────────────────────┬───────────────┬──────────┬─────────┐
│ Wallet Address      │ Alias         │ Status   │ Tags    │
├─────────────────────┼───────────────┼──────────┼─────────┤
│ 5xoBq7f3bLZ...TYCr │ Famous Whale  │ Active   │ whale   │
│ 8AKJHSLJf3J...9fSD │ Test Whale 2  │ Active   │ test    │
└─────────────────────┴───────────────┴──────────┴─────────┘
```

### JSON Format
```json
{
  "wallets": [
    {
      "address": "5xoBq7f3bLZzC1SUAo9GiTBJyDoku8C5WvFWJRgKTYCr",
      "alias": "Famous Whale",
      "is_active": true,
      "tags": ["whale"]
    }
  ]
}
```

### CSV Format
```csv
address,alias,status,tags
5xoBq7f3bLZzC1SUAo9GiTBJyDoku8C5WvFWJRgKTYCr,Famous Whale,Active,whale
8AKJHSLJf3JfkDJ39fjJSDFjksjdf93jfJFKDJ39fSD,Test Whale 2,Active,test
```

## Error Handling

The CLI provides clear error messages with suggested actions:

```bash
$ sonar wallet add invalid-address
Error: Invalid Solana wallet address format
Try: sonar wallet add <valid-solana-address>
Example: sonar wallet add 5xoBq7f3bLZzC1SUAo9GiTBJyDoku8C5WvFWJRgKTYCr

$ sonar signal get non-existent-id
Error: Signal not found: non-existent-id
Try: sonar signal list to see available signals
```

## Environment Variables

The CLI respects the following environment variables:

```bash
SONAR_CONFIG_PATH       # Configuration file path
SONAR_PROFILE          # Default profile name
SONAR_API_URL          # API endpoint URL
SONAR_API_KEY          # API authentication key
SONAR_LOG_LEVEL        # Log level: debug, info, warn, error
SONAR_NO_COLOR         # Disable colored output
```

## Shell Completion

The CLI supports shell completion for bash, zsh, and fish:

```bash
# Generate completion script
sonar completion bash > sonar-completion.bash
sonar completion zsh > _sonar
sonar completion fish > sonar.fish

# Install completion (bash)
source sonar-completion.bash

# Install completion (zsh)
fpath=(~/.zsh/completion $fpath)
autoload -U compinit && compinit
```

## Examples

### Common Workflows

```bash
# Add and monitor a new whale wallet
sonar wallet add 5xoBq7f3bLZzC1SUAo9GiTBJyDoku8C5WvFWJRgKTYCr \
  --alias "Famous Whale" \
  --tags "whale,degen"

# Watch for new signals in real-time
sonar signal list --status open --watch

# Check portfolio performance for the last 7 days
sonar portfolio performance --period 7d --by-day

# Export trade history for analysis
sonar utils export trades trading-history.csv --format csv

# Start all services in daemon mode
sonar service start --all --daemon --log-file ~/sonar/logs/services.log

# Monitor system health
sonar service health
```

### Advanced Usage

```bash
# Create custom signal rule
sonar config rules add \
  --name "Quick Scalp" \
  --min-whales 2 \
  --window 0.5 \
  --min-sol 5

# Analyze a specific wallet's trading patterns
sonar utils analyze 5xoBq7f3bLZzC1SUAo9GiTBJyDoku8C5WvFWJRgKTYCr \
  --period 30d \
  --output analysis-report.json

# Backup configuration and data
sonar config export > config-backup.json
sonar utils db backup sonar-backup-$(date +%Y%m%d).sql

# Run in different profile
sonar --profile production wallet list --active
```

## Development Guidelines

### Command Implementation Pattern

```typescript
// Example command implementation
export class WalletListCommand extends Command {
  static description = 'List tracked wallets';
  
  static flags = {
    active: flags.boolean({
      description: 'Show only active wallets',
      default: false,
    }),
    tags: flags.string({
      description: 'Filter by tags',
      multiple: true,
    }),
    format: flags.enum({
      description: 'Output format',
      options: ['table', 'json', 'csv'],
      default: 'table',
    }),
  };

  async run() {
    const { flags } = this.parse(WalletListCommand);
    // Implementation
  }
}
```

### Error Handling Pattern

```typescript
try {
  // Command logic
} catch (error) {
  if (error instanceof ValidationError) {
    this.error(`Invalid input: ${error.message}`, {
      suggestions: ['Check the format of your input'],
    });
  } else if (error instanceof ApiError) {
    this.error(`API error: ${error.message}`, {
      code: error.code,
    });
  } else {
    this.error('An unexpected error occurred', {
      exit: 1,
    });
  }
}
```

This CLI design provides a comprehensive interface for all Phase 1 functionality while maintaining consistency, usability, and extensibility for future phases.