// HTTP monitoring to identify sources of 429 rate limiting errors

const originalFetch = globalThis.fetch;

// Track which service/module is making calls
let currentService: string = 'Unknown';

export function setCurrentHttpService(serviceName: string) {
  currentService = serviceName;
}

// Wrap fetch to identify 429 sources
globalThis.fetch = async (input: any, init?: any) => {
  try {
    const response = await originalFetch(input, init);
    
    if (response.status === 429) {
      const url = typeof input === 'string' ? input : input.url;
      const domain = new URL(url).hostname;
      console.error(`[${currentService}] 🚫 Rate limited (429) by ${domain} - URL: ${url}`);
    }
    
    return response;
  } catch (error) {
    if (error.message && error.message.includes('429')) {
      const url = typeof input === 'string' ? input : input.url;
      console.error(`[${currentService}] 🚫 Rate limit error - ${error.message} - URL: ${url}`);
    }
    throw error;
  }
};

// Also monitor console.log/error to catch retry messages from libraries
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args: any[]) => {
  const message = args.join(' ');
  if (message.includes('Retrying after') && message.includes('delay')) {
    console.error(`[${currentService}] 🔄 ${message}`);
    return;
  }
  originalConsoleLog(...args);
};

console.error = (...args: any[]) => {
  const message = args.join(' ');
  if (message.includes('Retrying after') && message.includes('delay')) {
    console.error(`[${currentService}] 🔄 ${message}`);
    return;
  }
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  const message = args.join(' ');
  if (message.includes('Retrying after') && message.includes('delay')) {
    console.error(`[${currentService}] 🔄 ${message}`);
    return;
  }
  originalConsoleWarn(...args);
};