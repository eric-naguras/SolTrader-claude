export interface Trade {
  id: number;
  trade_type: 'BUY' | 'SELL';
  sol_amount: number;
  token_amount?: number;
  token_symbol: string;
  token_name?: string;
  token_address: string;
  price_usd?: number;
  transaction_hash: string;
  trade_timestamp: string;
  time_ago: string;
}

export class WalletTradeGroup {
  walletAddress: string;
  walletAlias: string;
  walletColor: string;
  walletImageData?: string;
  lastTradeTime: Date;
  trades: Trade[] = [];
  isVerified: boolean = false;
  totalSolVolume: number = 0;
  uniqueTokens: Set<string> = new Set();
  twitterHandle?: string;
  telegramChannel?: string;
  streamingChannel?: string;

  constructor(
    walletAddress: string,
    walletAlias?: string,
    walletColor?: string,
    isVerified?: boolean,
    twitterHandle?: string,
    telegramChannel?: string,
    streamingChannel?: string,
    walletImageData?: string
  ) {
    this.walletAddress = walletAddress;
    this.walletAlias = walletAlias || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    this.walletColor = walletColor || '#4338ca';
    this.walletImageData = walletImageData;
    this.isVerified = isVerified || false;
    this.lastTradeTime = new Date(0); // Initialize with epoch to ensure proper sorting
    this.twitterHandle = twitterHandle;
    this.telegramChannel = telegramChannel;
    this.streamingChannel = streamingChannel;
  }

  addTrade(trade: Trade) {
    this.trades.push(trade);
    this.trades.sort((a, b) => new Date(b.trade_timestamp).getTime() - new Date(a.trade_timestamp).getTime());
    
    // Keep only the most recent 10 trades
    if (this.trades.length > 10) {
      this.trades = this.trades.slice(0, 10);
    }

    // Update last trade time
    const tradeTime = new Date(trade.trade_timestamp);
    if (tradeTime > this.lastTradeTime) {
      this.lastTradeTime = tradeTime;
    }

    // Update total volume
    this.totalSolVolume += trade.sol_amount;

    // Track unique tokens
    this.uniqueTokens.add(trade.token_symbol);
  }

  getDisplayName(): string {
    return this.walletAlias;
  }

  getShortAddress(): string {
    return `${this.walletAddress.slice(0, 5)}...`;
  }

  formatTimeAgo(timestamp: string): string {
    const now = new Date();
    const tradeTime = new Date(timestamp);
    const diffMs = now.getTime() - tradeTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    if (diffMins > 0) return `${diffMins}m`;
    return 'now';
  }

  toCardHTML(): string {
    // Show only the first 5 trades
    const visibleTrades = this.trades.slice(0, 5);
    
    const tradesHTML = visibleTrades.map(trade => {
      const timeAgo = this.formatTimeAgo(trade.trade_timestamp);
      const solAmount = trade.sol_amount.toFixed(2);
      const typeClass = trade.trade_type.toLowerCase();
      
      // Abbreviate trade type
      const typeDisplay = trade.trade_type === 'BUY' ? 'B' : 'S';
      
      // Use token name if available, otherwise symbol
      const tokenDisplay = trade.token_name || trade.token_symbol;
      
      return `
        <div class="trade-row">
          <span class="trade-type ${typeClass}">${typeDisplay}</span>
          <span class="trade-amount">${solAmount} Sol</span>
          <span class="trade-token" title="${trade.token_name || trade.token_symbol}">${tokenDisplay}</span>
          <span class="trade-time">${timeAgo}</span>
        </div>
      `;
    }).join('');

    // Build social links
    let socials = [];
    if (this.twitterHandle) socials.push(`<a href="https://twitter.com/${this.twitterHandle.replace('@', '')}" target="_blank" title="Twitter">🐦</a>`);
    if (this.telegramChannel) socials.push(`<a href="${this.telegramChannel.startsWith('http') ? this.telegramChannel : 'https://' + this.telegramChannel}" target="_blank" title="Telegram"><img src="/images/telegram-icon.svg" class="social-icon" alt="Telegram"></a>`);
    if (this.streamingChannel) socials.push(`<a href="${this.streamingChannel.startsWith('http') ? this.streamingChannel : 'https://' + this.streamingChannel}" target="_blank" title="Stream">📺</a>`);
    
    const socialsHtml = socials.length > 0 ? `<div class="wallet-socials">${socials.join(' ')}</div>` : '';

    // Build wallet avatar
    const avatarHtml = this.walletImageData 
      ? `<img src="${this.walletImageData}" alt="${this.walletAlias}" class="wallet-avatar">`
      : `<span class="wallet-dot" style="background-color: ${this.walletColor};"></span>`;

    return `
      <article class="wallet-trade-card" data-wallet="${this.walletAddress}">
        <div class="wallet-header">
          <div class="wallet-info">
            ${avatarHtml}
            <strong class="wallet-name">${this.walletAlias}</strong>
            ${this.isVerified ? '<span class="verified-badge">✓</span>' : ''}
          </div>
          ${socialsHtml}
        </div>
        <div class="trades-list">
          ${tradesHTML}
        </div>
      </article>
    `;
  }
}

export class WalletTradeManager {
  private wallets: Map<string, WalletTradeGroup> = new Map();

  addTrade(
    walletAddress: string,
    trade: Trade,
    walletAlias?: string,
    walletColor?: string,
    isVerified?: boolean,
    twitterHandle?: string,
    telegramChannel?: string,
    streamingChannel?: string,
    walletImageData?: string
  ) {
    if (!this.wallets.has(walletAddress)) {
      this.wallets.set(
        walletAddress,
        new WalletTradeGroup(walletAddress, walletAlias, walletColor, isVerified, twitterHandle, telegramChannel, streamingChannel, walletImageData)
      );
    }
    
    const wallet = this.wallets.get(walletAddress)!;
    wallet.addTrade(trade);
  }

  getSortedWallets(): WalletTradeGroup[] {
    return Array.from(this.wallets.values())
      .sort((a, b) => b.lastTradeTime.getTime() - a.lastTradeTime.getTime());
  }

  getWallet(address: string): WalletTradeGroup | undefined {
    return this.wallets.get(address);
  }

  clear() {
    this.wallets.clear();
  }
}