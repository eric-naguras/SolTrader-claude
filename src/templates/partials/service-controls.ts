import { toggleSwitch } from './toggle-switch.js';

export interface ServiceControlConfig {
  serviceName: string;
  displayName: string;
  enabled: boolean;
  description?: string;
}

export const serviceControlsTemplate = (services: ServiceControlConfig[]) => `
  <form id="service-controls-form">
    <h3>Service Management</h3>
    <p class="text-muted">Enable or disable individual services. Disabled services will not start automatically on server restart.</p>
    
    <div class="service-controls-grid">
      ${services.map(service => `
        <div class="service-control-item" id="service-${service.serviceName}">
          <div class="service-toggle">
            ${toggleSwitch({
              name: service.serviceName,
              checked: service.enabled,
              label: service.displayName,
              description: service.description,
              htmxPut: `/htmx/service-control/${service.serviceName}/toggle`,
              htmxTarget: '#service-controls',
              htmxSwap: 'innerHTML'
            })}
          </div>
          <div class="service-status" id="service-status-${service.serviceName}">
            <span class="status-indicator ${service.enabled ? 'status-enabled' : 'status-disabled'}">
              ${service.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      `).join('')}
    </div>

    <div id="service-control-message" class="alert" style="display: none; margin-top: 1rem;"></div>
  </form>

  <style>
    .service-controls-grid {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 1rem;
    }

    .service-control-item {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .service-toggle {
      flex: 1;
    }

    .service-status {
      display: flex;
      align-items: center;
      margin-left: 1rem;
    }

    .status-indicator {
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .status-enabled {
      background: #d4edda;
      color: #155724;
    }

    .status-disabled {
      background: #f8d7da;
      color: #721c24;
    }

    .text-muted {
      color: #6c757d;
    }
  </style>
`;