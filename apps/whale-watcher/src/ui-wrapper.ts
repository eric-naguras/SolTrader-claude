import { spawn } from 'child_process';
import chalk from 'chalk';
import boxen from 'boxen';

interface Status {
  helius: 'connected' | 'connecting' | 'error' | 'disconnected';
  database: 'connected' | 'error';
  wallets: number;
  lastTrade?: {
    wallet: string;
    token: string;
    type: 'BUY' | 'SELL';
    amount: number;
    time: Date;
  };
  tradesProcessed: number;
  signalsGenerated: number;
  uptime: number;
}

class WhaleWatcherUI {
  private status: Status = {
    helius: 'connecting',
    database: 'connected',
    wallets: 0,
    tradesProcessed: 0,
    signalsGenerated: 0,
    uptime: 0
  };
  
  private startTime = Date.now();
  private refreshInterval?: NodeJS.Timeout;

  constructor() {
    // Clear screen and hide cursor
    console.clear();
    console.log('\x1B[?25l'); // Hide cursor
    
    // Handle exit gracefully
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  private cleanup() {
    console.log('\x1B[?25h'); // Show cursor
    console.clear();
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    process.exit(0);
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'connected': return chalk.green('●');
      case 'connecting': return chalk.yellow('◐');
      case 'error': return chalk.red('●');
      case 'disconnected': return chalk.gray('●');
      default: return chalk.gray('●');
    }
  }

  private formatUptime(): string {
    const seconds = Math.floor(this.status.uptime / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private render() {
    // Move cursor to top-left
    process.stdout.write('\x1B[H');
    
    // Build the UI
    const header = chalk.bold.cyan('🐋 Sonar Whale Watcher');
    
    const statusSection = [
      chalk.bold('System Status:'),
      `  Helius WebSocket: ${this.getStatusColor(this.status.helius)} ${this.status.helius}`,
      `  Database: ${this.getStatusColor(this.status.database)} ${this.status.database}`,
      `  Uptime: ${this.formatUptime()}`,
      '',
      chalk.bold('Monitoring:'),
      `  Active Wallets: ${chalk.cyan(this.status.wallets)}`,
      `  Trades Processed: ${chalk.yellow(this.status.tradesProcessed)}`,
      `  Signals Generated: ${chalk.green(this.status.signalsGenerated)}`
    ].join('\n');

    let lastTradeSection = '';
    if (this.status.lastTrade) {
      const trade = this.status.lastTrade;
      const tradeColor = trade.type === 'BUY' ? chalk.green : chalk.red;
      lastTradeSection = [
        '',
        chalk.bold('Last Trade:'),
        `  Wallet: ${trade.wallet.substring(0, 8)}...`,
        `  Token: ${trade.token.substring(0, 8)}...`,
        `  Type: ${tradeColor(trade.type)}`,
        `  Amount: ${trade.amount.toFixed(2)} SOL`,
        `  Time: ${trade.time.toLocaleTimeString()}`
      ].join('\n');
    }

    const content = statusSection + lastTradeSection;
    
    const box = boxen(content, {
      title: header,
      titleAlignment: 'center',
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    });

    // Clear screen and print
    console.clear();
    console.log(box);
    
    // Instructions at bottom
    console.log(chalk.gray('  Press Ctrl+C to exit'));
  }

  public start() {
    // Start the actual whale-watcher process
    const child = spawn('npm', ['start'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Parse output from whale-watcher
    child.stdout.on('data', (data) => {
      const output = data.toString();
      
      // Parse different log types
      if (output.includes('WhaleWatcher initialized')) {
        this.status.helius = 'connecting';
      } else if (output.includes('WebSocket connected') || output.includes('started successfully')) {
        this.status.helius = 'connected';
      } else if (output.includes('WebSocket error') || output.includes('Connection error')) {
        this.status.helius = 'error';
      } else if (output.includes('Loaded') && output.includes('wallets')) {
        const match = output.match(/Loaded (\d+) wallets/);
        if (match) {
          this.status.wallets = parseInt(match[1]);
        }
      } else if (output.includes('Trade detected')) {
        this.status.tradesProcessed++;
        
        // Parse trade details
        const walletMatch = output.match(/Wallet: ([^\s]+)/);
        const tokenMatch = output.match(/Token: ([^\s]+)/);
        const typeMatch = output.match(/Type: (BUY|SELL)/);
        const amountMatch = output.match(/Amount: ([\d.]+)/);
        
        if (walletMatch && tokenMatch && typeMatch && amountMatch) {
          this.status.lastTrade = {
            wallet: walletMatch[1],
            token: tokenMatch[1],
            type: typeMatch[1] as 'BUY' | 'SELL',
            amount: parseFloat(amountMatch[1]),
            time: new Date()
          };
        }
      } else if (output.includes('Signal created')) {
        this.status.signalsGenerated++;
      }
    });

    child.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('Error')) {
        this.status.helius = 'error';
      }
    });

    child.on('exit', () => {
      this.status.helius = 'disconnected';
      this.cleanup();
    });

    // Update UI every second
    this.refreshInterval = setInterval(() => {
      this.status.uptime = Date.now() - this.startTime;
      this.render();
    }, 1000);

    // Initial render
    this.render();
  }
}

// Start the UI
const ui = new WhaleWatcherUI();
ui.start();