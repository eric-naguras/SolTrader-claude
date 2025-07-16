export const walletsPage = () => `<section x-data="walletForm" x-init="init()">
    <h1>Tracked Wallets</h1>
    
    <!-- Add Wallet Form -->
    <details :open="showForm">
        <summary role="button" @click="showForm = !showForm">Add New Wallet</summary>
        <form @submit.prevent="submitForm">
            <div class="grid">
                <div>
                    <label for="address">
                        Wallet Address *
                        <input type="text" id="address" x-model="address" required 
                               placeholder="Enter Solana wallet address"
                               @input="validateAddress()"
                               :class="{ 'validation-error': addressError }"
                               autocomplete="off">
                        <small x-show="addressError" x-text="addressError" class="error-text"></small>
                    </label>
                </div>
                <div>
                    <label for="alias">
                        Alias *
                        <input type="text" id="alias" x-model="alias" required
                               placeholder="e.g., Smart Money #1"
                               @input="validateAlias()"
                               :class="{ 'validation-error': aliasError }">
                        <small x-show="aliasError" x-text="aliasError" class="error-text"></small>
                    </label>
                </div>
            </div>
            
            <div class="grid">
                <div>
                    <label for="tags">
                        Tags * (comma-separated)
                        <input type="text" id="tags" x-model="tags" required
                               placeholder="e.g., whale, insider, kol"
                               @input="validateTags()"
                               :class="{ 'validation-error': tagsError }">
                        <small x-show="tagsError" x-text="tagsError" class="error-text"></small>
                    </label>
                </div>
                <div>
                    <label for="ui_color">
                        Display Color *
                        <input type="color" id="ui_color" x-model="ui_color" required>
                    </label>
                </div>
            </div>
            
            <div class="grid">
                <div>
                    <label for="twitter_handle">
                        Twitter Handle
                        <input type="text" id="twitter_handle" x-model="twitter_handle" 
                               placeholder="@username">
                    </label>
                </div>
                <div>
                    <label for="telegram_channel">
                        Telegram Channel
                        <input type="text" id="telegram_channel" x-model="telegram_channel" 
                               placeholder="t.me/channel">
                    </label>
                </div>
            </div>
            
            <div class="grid">
                <div>
                    <label for="streaming_channel">
                        Streaming Channel
                        <input type="text" id="streaming_channel" x-model="streaming_channel" 
                               placeholder="twitch.tv/username or youtube.com/@channel">
                    </label>
                </div>
                <div>
                    <label>
                        Profile Icon
                        <div class="paste-area" 
                             @paste="handleImagePaste"
                             @click.prevent
                             :class="{ 'has-image': image_data }"
                             tabindex="0">
                            <template x-if="!image_data">
                                <div class="paste-placeholder">
                                    <div>Paste image here (Ctrl+V)</div>
                                    <div style="margin-top: 0.5rem;">or</div>
                                    <button type="button" 
                                            @click.stop="$refs.imageInput.click()" 
                                            class="outline"
                                            style="font-size: 0.875rem; padding: 0.25rem 0.75rem; margin-top: 0.5rem;">
                                        Choose File
                                    </button>
                                </div>
                            </template>
                            <template x-if="image_data">
                                <div style="position: relative;">
                                    <img :src="image_data" alt="Profile icon" style="max-width: 100px; max-height: 100px;">
                                    <button type="button" 
                                            @click="image_data = null; $refs.imageInput.value = ''" 
                                            style="position: absolute; top: -8px; right: -8px; padding: 0.125rem 0.375rem; font-size: 0.75rem;"
                                            class="secondary">
                                        ×
                                    </button>
                                </div>
                            </template>
                        </div>
                        <input type="file" 
                               id="image_upload" 
                               x-ref="imageInput"
                               @change="handleImageUpload" 
                               accept="image/*"
                               style="display: none;">
                    </label>
                </div>
            </div>
            
            <div>
                <label for="notes">
                    Notes
                    <textarea id="notes" x-model="notes" rows="3" 
                              placeholder="Additional notes about this wallet..."></textarea>
                </label>
            </div>
            
            <div class="grid">
                <button type="submit" :disabled="!isFormValid" :class="{ 'disabled': !isFormValid }">Add Wallet</button>
                <button type="button" class="secondary" @click="showForm = false">Cancel</button>
            </div>
        </form>
    </details>

    <!-- Wallets Table -->
    <div id="wallets-table" hx-get="/htmx/partials/wallets-table" hx-trigger="load, refresh">
        <article aria-busy="true">Loading wallets...</article>
    </div>
    
    <!-- Edit Wallet Modal -->
    <dialog id="edit-wallet-modal">
        <article x-data="walletEditForm">
            <header>
                <h3>Edit Wallet</h3>
                <a href="#" aria-label="Close" class="close" @click="closeModal()"></a>
            </header>
            
            <form @submit.prevent="updateWallet">
                <div class="grid">
                    <div>
                        <label for="edit-alias">
                            Alias *
                            <input type="text" id="edit-alias" x-model="editData.alias" required
                                   @input="validateEditAlias()"
                                   :class="{ 'validation-error': editAliasError }">
                            <small x-show="editAliasError" x-text="editAliasError" class="error-text"></small>
                        </label>
                    </div>
                    <div>
                        <label for="edit-tags">
                            Tags * (comma-separated)
                            <input type="text" id="edit-tags" x-model="editData.tags" required
                                   @input="validateEditTags()"
                                   :class="{ 'validation-error': editTagsError }">
                            <small x-show="editTagsError" x-text="editTagsError" class="error-text"></small>
                        </label>
                    </div>
                </div>
                
                <div class="grid">
                    <div>
                        <label for="edit-twitter">
                            Twitter Handle
                            <input type="text" id="edit-twitter" x-model="editData.twitter_handle" 
                                   placeholder="@username">
                        </label>
                    </div>
                    <div>
                        <label for="edit-telegram">
                            Telegram Channel
                            <input type="text" id="edit-telegram" x-model="editData.telegram_channel" 
                                   placeholder="t.me/channel">
                        </label>
                    </div>
                </div>
                
                <div class="grid">
                    <div>
                        <label for="edit-streaming">
                            Streaming Channel
                            <input type="text" id="edit-streaming" x-model="editData.streaming_channel" 
                                   placeholder="twitch.tv/username">
                        </label>
                    </div>
                    <div>
                        <label for="edit-color">
                            Display Color
                            <input type="color" id="edit-color" x-model="editData.ui_color">
                        </label>
                    </div>
                </div>
                
                <div class="grid">
                    <div>
                        <label>
                            Profile Icon
                            <div class="paste-area" 
                                 @paste="handleEditImagePaste"
                                 @click.prevent
                                 :class="{ 'has-image': editData.image_data }"
                                 tabindex="0">
                                <template x-if="!editData.image_data">
                                    <div class="paste-placeholder">
                                        <div>Paste image here (Ctrl+V)</div>
                                        <div style="margin-top: 0.5rem;">or</div>
                                        <button type="button" 
                                                @click.stop="$refs.editImageInput.click()" 
                                                class="outline"
                                                style="font-size: 0.875rem; padding: 0.25rem 0.75rem; margin-top: 0.5rem;">
                                            Choose File
                                        </button>
                                    </div>
                                </template>
                                <template x-if="editData.image_data">
                                    <div style="position: relative;">
                                        <img :src="editData.image_data" alt="Profile icon" style="max-width: 100px; max-height: 100px;">
                                        <button type="button" 
                                                @click="editData.image_data = null; $refs.editImageInput.value = ''" 
                                                style="position: absolute; top: -8px; right: -8px; padding: 0.125rem 0.375rem; font-size: 0.75rem;"
                                                class="secondary">
                                            ×
                                        </button>
                                    </div>
                                </template>
                            </div>
                            <input type="file" 
                                   id="edit-image" 
                                   x-ref="editImageInput"
                                   @change="handleEditImageUpload" 
                                   accept="image/*"
                                   style="display: none;">
                        </label>
                    </div>
                    <div>
                        <label>
                            Status
                            <label for="edit-active">
                                <input type="checkbox" id="edit-active" x-model="editData.is_active" role="switch">
                                Active
                            </label>
                        </label>
                    </div>
                </div>
                
                <div>
                    <label for="edit-notes">
                        Notes
                        <textarea id="edit-notes" x-model="editData.notes" rows="3"></textarea>
                    </label>
                </div>
                
                <footer>
                    <div class="grid">
                        <button type="submit" :disabled="!isEditFormValid" :class="{ 'disabled': !isEditFormValid }">Save Changes</button>
                        <button type="button" class="secondary" @click="closeModal()">Cancel</button>
                    </div>
                </footer>
            </form>
        </article>
    </dialog>
</section>`;