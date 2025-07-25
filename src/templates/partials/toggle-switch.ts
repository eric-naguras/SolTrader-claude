export interface ToggleSwitchProps {
  name: string;
  checked: boolean;
  label: string;
  description?: string;
  htmxPost?: string;
  htmxPut?: string;
  htmxTarget?: string;
  htmxSwap?: string;
  htmxTrigger?: string;
}

export const toggleSwitch = (props: ToggleSwitchProps) => {
  const {
    name,
    checked,
    label,
    description,
    htmxPost,
    htmxPut,
    htmxTarget,
    htmxSwap = 'outerHTML',
    htmxTrigger = 'change'
  } = props;

  const htmxAttrs = [
    htmxPost ? `hx-post="${htmxPost}"` : '',
    htmxPut ? `hx-put="${htmxPut}"` : '',
    htmxTarget ? `hx-target="${htmxTarget}"` : '',
    `hx-swap="${htmxSwap}"`,
    `hx-trigger="${htmxTrigger}"`
  ].filter(Boolean).join(' ');

  return `
    <label class="switch" role="switch">
      <input
        type="checkbox"
        name="${name}"
        ${checked ? 'checked' : ''}
        ${htmxAttrs}
      />
      <span class="slider"></span>
      <span class="label">
        <strong>${label}</strong>
        ${description ? `<br><small class="text-muted">${description}</small>` : ''}
      </span>
    </label>
  `;
};

// CSS for toggle switches - should be included once in the layout or a global CSS file
export const toggleSwitchStyles = `
  .switch {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-weight: 500;
    color: var(--pico-color);
    user-select: none;
    padding: 0.5rem 0;
  }

  .switch input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .switch .slider {
    position: relative;
    width: 50px;
    height: 30px;
    background: var(--pico-muted-border-color);
    border-radius: 9999px;
    border: 2px solid var(--pico-border-color);
    transition: background 0.3s, border-color 0.3s;
    flex-shrink: 0;
  }

  .switch .slider::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 24px;
    height: 24px;
    background: white;
    border-radius: 9999px;
    transition: transform 0.3s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  /* Checked (ON) state */
  .switch input:checked + .slider {
    background: #4c9aff;
    border-color: #4c9aff;
  }

  .switch input:checked + .slider::before {
    transform: translateX(20px);
  }

  /* Focus & hover effects */
  .switch input:focus-visible + .slider {
    outline: 2px solid #4c9aff;
    outline-offset: 2px;
  }

  .switch:hover .slider {
    border-color: #4c9aff;
  }

  /* Label styling */
  .switch .label {
    display: block;
  }

  .switch .label strong {
    font-weight: 600;
  }

  .switch .label small {
    font-size: 0.875rem;
    line-height: 1.2;
  }
`;