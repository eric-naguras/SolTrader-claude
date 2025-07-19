import { TrackedWallet } from '../../lib/database';
import { walletRowPartial } from './wallet-row';

const renderSortIcon = (isCurrentSort: boolean, sortOrder: 'asc' | 'desc') => {
    if (isCurrentSort) {
        const icon = sortOrder === 'asc' ? '▲' : '▼';
        return `<span class="sort-icon active">${icon}</span>`;
    }
    return `<span class="sort-icon inactive">▼</span>`;
};

export function walletsTablePartial(wallets: TrackedWallet[], sortBy: string = 'created_at', sortOrder: 'asc' | 'desc' = 'desc'): string {
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

    const buildSortableTh = (key: string, label: string) => {
        const isCurrentSort = key === sortBy;
        const newSortOrderForHeader = isCurrentSort ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc';
        return `
            <th hx-get="/htmx/partials/wallets-table?sortBy=${key}&sortOrder=${newSortOrderForHeader}" class="sortable">
              ${label} ${renderSortIcon(isCurrentSort, sortOrder)}
            </th>
        `;
    };

  let tableHtml = /*html*/ `
    <table hx-target="this" hx-swap="outerHTML">
      <thead>
        <tr>
          <th></th>
          ${buildSortableTh('alias', 'Alias')}
          <th>Address</th>
          <th>Socials</th>
          ${buildSortableTh('sol_balance', 'Balance')}
          ${buildSortableTh('tags', 'Tags')}
          ${buildSortableTh('is_active', 'Status')}
          ${buildSortableTh('created_at', 'Age')}
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

// Helper function to format time since a date
export function timeSince(dateString: string): string {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) {
    return Math.floor(interval) + "y";
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    return Math.floor(interval) + "mo";
  }
  interval = seconds / 86400;
  if (interval > 1) {
    return Math.floor(interval) + "d";
  }
  interval = seconds / 3600;
  if (interval > 1) {
    return Math.floor(interval) + "h";
  }
  interval = seconds / 60;
  if (interval > 1) {
    return Math.floor(interval) + "m";
  }
  return Math.floor(seconds) + "s";
}