import { WalletWithTrader } from '../../lib/database';

export function walletRowPartial(wallet: WalletWithTrader): string {
  const socials = [];
  if (wallet.twitter_handle) {
    socials.push(`<a href="https://twitter.com/${wallet.twitter_handle.replace('@', '')}" target="_blank" title="Twitter">🐦</a>`);
  }
  if (wallet.telegram_channel) {
    socials.push(`<a href="${wallet.telegram_channel.startsWith('http') ? wallet.telegram_channel : 'https://' + wallet.telegram_channel}" target="_blank" title="Telegram">💬</a>`);
  }
  if (wallet.streaming_channel) {
    socials.push(`<a href="${wallet.streaming_channel.startsWith('http') ? wallet.streaming_channel : 'https://' + wallet.streaming_channel}" target="_blank" title="Stream">📺</a>`);
  }

  const solBalanceNum = typeof wallet.sol_balance === 'number' ? wallet.sol_balance : Number(wallet.sol_balance);
  const formattedBalance = solBalanceNum 
    ? (solBalanceNum >= 1 
        ? Math.round(solBalanceNum).toString() 
        : solBalanceNum.toFixed(1))
    : '-';
  const createdDate = new Date(wallet.created_at);
  const age = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  
  return /*html*/ `
    <tr id="wallet-row-${wallet.address}"
        data-wallet-address="${wallet.address}"
        data-trader-alias="${wallet.trader_alias}"
        data-trader-tags="${wallet.trader_tags ? wallet.trader_tags.join(',') : ''}"
        data-wallet-active="${wallet.is_active}"
        data-trader-color="${wallet.trader_color || '#4338ca'}"
        data-trader-twitter="${wallet.twitter_handle || ''}"
        data-trader-telegram="${wallet.telegram_channel || ''}"
        data-trader-streaming="${wallet.streaming_channel || ''}"
        data-trader-notes="${wallet.trader_notes || ''}"
        data-trader-image="${wallet.image_data || ''}"
        data-trader-id="${wallet.trader_id}">
      <td>
        ${wallet.image_data 
          ? `<img src="${wallet.image_data}" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">` 
          : `<span class="wallet-color" style="background-color: ${wallet.trader_color || '#4338ca'}"></span>`
        }
      </td>
      <td>
        <a href="#" onclick="editTrader('${wallet.trader_id}'); return false;" 
           style="text-decoration: none; color: inherit; ${wallet.has_conflicts ? 'display: inline-block; padding: 4px; border: 2px solid #dc3545; border-radius: 4px;' : ''}">
          <strong>${wallet.trader_alias || wallet.trader_name}</strong>
        </a>
        ${wallet.trader_notes ? `<br><small style="color: var(--pico-muted-color);">${wallet.trader_notes.substring(0, 50)}${wallet.trader_notes.length > 50 ? '...' : ''}</small>` : ''}
        ${wallet.has_conflicts ? `<br><small style="color: #dc3545;">⚠️ Ownership conflict</small>` : ''}
      </td>
      <td><code>${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}</code></td>
      <td>${socials.length > 0 ? socials.join(' ') : '-'}</td>
      <td>${formattedBalance} SOL</td>
      <td>${wallet.trader_tags ? wallet.trader_tags.join(', ') : '-'}</td>
      <td><span class="status-badge ${wallet.is_active ? 'active' : 'inactive'}">${wallet.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>${age}d</td>
      <td>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="outline" 
                  hx-patch="/htmx/wallets/${wallet.address}/toggle"
                  hx-target="#wallet-row-${wallet.address}"
                  hx-swap="outerHTML"
                  style="padding: 0.25rem 0.5rem; font-size: 1.2rem; border-radius: 4px;"
                  title="${wallet.is_active ? 'Deactivate' : 'Activate'}">
            ${wallet.is_active ? '⏸️' : '▶️'}
          </button>
          <button class="secondary outline" 
                  onclick="deleteWallet('${wallet.address}')"
                  style="padding: 0.25rem 0.5rem; font-size: 1.2rem; border-radius: 4px;"
                  title="Delete wallet">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `;
}