import { TrackedWallet } from '../../lib/database';
import { walletRowPartial } from './wallet-row';

export function walletsTablePartial(wallets: TrackedWallet[]): string {
  if (wallets.length === 0) {
    return /*html*/ `
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Alias</th>
            <th>Address</th>
            <th>Socials</th>
            <th>Balance</th>
            <th>Tags</th>
            <th>Status</th>
            <th>Age</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="9" style="text-align: center; padding: 2rem;">
              <p>No wallets tracked yet</p>
              <p style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--pico-muted-color);">
                Add your first wallet to start monitoring whale activity
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    `;
  }

  let tableHtml = /*html*/ `
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Alias</th>
          <th>Address</th>
          <th>Socials</th>
          <th>Balance</th>
          <th>Tags</th>
          <th>Status</th>
          <th>Age</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  wallets.forEach(wallet => {
    tableHtml += walletRowPartial(wallet);
  });

  tableHtml += /*html*/ `
      </tbody>
    </table>
  `;

  return tableHtml;
}

export function walletsTableErrorPartial(): string {
  return /*html*/ `
    <div style="text-align: center; padding: 2rem; color: var(--pico-del-color);">
      <p>Failed to load wallets</p>
      <button onclick="htmx.trigger('#wallets-table', 'refresh')" class="outline" style="margin-top: 1rem;">
        Retry
      </button>
    </div>
  `;
}