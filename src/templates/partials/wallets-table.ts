import { TrackedWallet } from '../../lib/database';
import { walletRowPartial } from './wallet-row';

const renderSortIcon = (isCurrentSort: boolean, sortOrder: 'asc' | 'desc') => {
    if (isCurrentSort) {
        const icon = sortOrder === 'asc' ? '▲' : '▼';
        return `<span class="sort-icon active">${icon}</span>`;
    }
    return `<span class="sort-icon inactive">▼</span>`;
};

export function walletsTablePartial(wallets: TrackedWallet[], sortBy: string = 'created_at', sortOrder: 'asc' | 'desc' = 'desc', selectedTags: string[] = [], allTags: string[] = []): string {
  // Create tag filter component
  let tagFilterHtml = '';
  if (allTags.length > 0) {
    const selectedTagsSet = new Set(selectedTags);
    
    tagFilterHtml = /*html*/ `
      <div class="tag-filter-container" x-data="tagFilter" x-init="init()">
        <div class="tag-filter-header">
          <h1>Tracked Wallets</h1>
          <div class="tag-filter-icon-wrapper">
            <button class="tag-filter-icon" 
                    @click="showFilter = !showFilter; if(showFilter) { selectedTags = [...appliedTags] }"
                    @mouseenter="showPreview = true" 
                    @mouseleave="showPreview = false"
                    :class="{ 'has-active-filters': appliedTags.length > 0 && appliedTags.length < allTags.length }">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
              </svg>
              <span x-show="appliedTags.length > 0 && appliedTags.length < allTags.length" class="filter-count" x-text="appliedTags.length"></span>
            </button>
            
            <!-- Preview on hover -->
            <div class="tag-filter-popup" 
                 x-show="showPreview && !showFilter" 
                 x-transition
                 @mouseenter="showPreview = true"
                 @mouseleave="showPreview = false">
              <div class="tag-filter-content preview">
                ${allTags.map(tag => `
                  <label class="tag-checkbox ${selectedTagsSet.has(tag) ? 'checked' : ''}">
                    <input type="checkbox" ${selectedTagsSet.has(tag) ? 'checked' : ''} disabled>
                    <span>${tag}</span>
                    ${selectedTagsSet.has(tag) ? '<span class="checkmark">✓</span>' : ''}
                  </label>
                `).join('')}
              </div>
            </div>
            
            <!-- Interactive filter -->
            <div class="tag-filter-popup interactive" 
                 x-show="showFilter"
                 x-transition
                 @click.outside="cancelFilters(); showFilter = false">
              <div class="tag-filter-header-controls">
                <label class="toggle-all-label">
                  <input type="checkbox" 
                         role="switch"
                         :checked="selectedTags.length === allTags.length && allTags.length > 0"
                         @change="$event.target.checked ? selectAll() : clearAll()">
                  <span x-text="selectedTags.length === allTags.length && allTags.length > 0 ? 'Deselect All' : 'Select All'"></span>
                </label>
              </div>
              <div class="tag-filter-content">
                ${allTags.map(tag => `
                  <label class="tag-checkbox" :class="{ 'checked': selectedTags.includes('${tag}') }">
                    <input type="checkbox" 
                           value="${tag}"
                           ${selectedTagsSet.has(tag) ? 'checked' : ''}
                           :checked="selectedTags.includes('${tag}')"
                           @change="toggleTag('${tag}')">
                    <span>${tag}</span>
                  </label>
                `).join('')}
              </div>
              <div class="tag-filter-footer">
                <button @click="applyFilters(); showFilter = false" class="primary">Apply</button>
                <button @click="cancelFilters(); showFilter = false" class="secondary outline">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    tagFilterHtml = '<h1>Tracked Wallets</h1>';
  }

  if (wallets.length === 0 && selectedTags.length === 0) {
    return /*html*/ `
      ${tagFilterHtml}
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

  if (wallets.length === 0 && selectedTags.length > 0) {
    return /*html*/ `
      ${tagFilterHtml}
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
              <p>No wallets found with selected tags</p>
              <p style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--pico-muted-color);">
                Try selecting different tags or clear the filter
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
        const currentTagsParam = selectedTags.length > 0 ? `&tags=${selectedTags.join(',')}` : '';
        return `
            <th hx-get="/htmx/partials/wallets-table?sortBy=${key}&sortOrder=${newSortOrderForHeader}${currentTagsParam}" class="sortable">
              ${label} ${renderSortIcon(isCurrentSort, sortOrder)}
            </th>
        `;
    };

  let tableHtml = /*html*/ `
    ${tagFilterHtml}
    <table hx-target="#wallets-table" hx-swap="innerHTML">
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