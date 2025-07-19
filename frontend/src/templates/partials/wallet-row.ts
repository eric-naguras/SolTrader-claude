import { TrackedWallet } from '../../lib/database';

export function walletRowPartial(wallet: TrackedWallet): string {
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
        data-wallet-alias="${wallet.alias}"
        data-wallet-tags="${wallet.tags ? wallet.tags.join(',') : ''}"
        data-wallet-active="${wallet.is_active}"
        data-wallet-color="${wallet.ui_color || '#4338ca'}"
        data-wallet-twitter="${wallet.twitter_handle || ''}"
        data-wallet-telegram="${wallet.telegram_channel || ''}"
        data-wallet-streaming="${wallet.streaming_channel || ''}"
        data-wallet-notes="${wallet.notes || ''}"
        data-wallet-image="${wallet.image_data || ''}">
      <td>
        ${wallet.image_data 
          ? `<img src="${wallet.image_data}" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">` 
          : `<span class="wallet-color" style="background-color: ${wallet.ui_color || '#4338ca'}"></span>`
        }
      </td>
      <td>
        <a href="#" onclick="editWallet('${wallet.address}'); return false;" style="text-decoration: none; color: inherit;">
          <strong>${wallet.alias}</strong>
        </a>
        ${wallet.notes ? `<br><small style="color: var(--pico-muted-color);">${wallet.notes.substring(0, 50)}${wallet.notes.length > 50 ? '...' : ''}</small>` : ''}
      </td>
      <td><code>${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}</code></td>
      <td>${socials.length > 0 ? socials.join(' ') : '-'}</td>
      <td>${formattedBalance} SOL</td>
      <td>${wallet.tags ? wallet.tags.join(', ') : '-'}</td>
      <td><span class="status-badge ${wallet.is_active ? 'active' : 'inactive'}">${wallet.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>${age}d</td>
      <td>
        <div class="grid" style="gap: 0.25rem; margin: 0;">
          <button class="outline" 
                  hx-patch="/htmx/wallets/${wallet.address}/toggle"
                  hx-target="#wallet-row-${wallet.address}"
                  hx-swap="outerHTML"
                  style="padding: 0.25rem 0.5rem; font-size: 0.875rem;">
            ${wallet.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button class="secondary outline" 
                  onclick="deleteWallet('${wallet.address}')"
                  style="padding: 0.25rem 0.5rem; font-size: 0.875rem;">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `;
}