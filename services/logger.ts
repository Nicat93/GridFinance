

export type LogLevel = 'info' | 'warn' | 'error' | 'log';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  messages: string[];
}

const MAX_LOGS = 100;
const STORAGE_KEY = 'grid_finance_logs';

class LoggerService {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];
  private originalConsole: { [key: string]: any } = {};

  init() {
    // Load persisted logs
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.logs = JSON.parse(saved);
      }
    } catch (e) {
      // Ignore parsing errors
    }

    // Capture console methods
    const methods: LogLevel[] = ['log', 'info', 'warn', 'error'];
    methods.forEach(method => {
      this.originalConsole[method] = console[method].bind(console);
      
      // @ts-ignore
      console[method] = (...args: any[]) => {
        // 1. Call original method so developer tools still work
        this.originalConsole[method](...args);
        
        // 2. Add to internal log
        this.addLog(method, args);
      };
    });
  }

  private addLog(level: LogLevel, args: any[]) {
    const messages = args.map(arg => {
      if (arg === undefined) return 'undefined';
      if (arg === null) return 'null';

      // 1. Handle standard Error objects directly
      if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
      }
      
      // 2. Handle Objects (including Error-like objects from other contexts)
      if (typeof arg === 'object') {
        try {
            // Check specifically for error-like properties if instanceof failed (e.g. from different window/iframe context)
            if (arg.message && (arg.name || arg.stack)) {
                 return `${arg.name || 'Error'}: ${arg.message}\n${arg.stack || ''}`;
            }

            const str = JSON.stringify(arg);
            
            // If JSON.stringify returns empty object, it might be an Error, Event, or have non-enumerable props
            if (str === '{}') {
                 // Try to extract own property names manually
                 const props = Object.getOwnPropertyNames(arg);
                 if (props.length > 0) {
                     const obj: any = {};
                     props.forEach(key => obj[key] = (arg as any)[key]);
                     const str2 = JSON.stringify(obj);
                     if (str2 !== '{}') return str2;
                 }
                 
                 // Check if it's a DOMException or similar
                 if (arg.constructor && arg.constructor.name) {
                    // e.g. "DOMException: ..."
                    if (arg.message) return `${arg.constructor.name}: ${arg.message}`;
                 }

                 // Fallback to toString if it's meaningful
                 if (arg.toString && arg.toString() !== '[object Object]') {
                    return arg.toString();
                 }
                 
                 // Last resort
                 if (arg.message) return arg.message;
            }
            
            return str.length > 500 ? str.substring(0, 500) + '...' : str;
        } catch (e) {
          return '[Circular or Non-Serializable Object]';
        }
      }
      return String(arg);
    });

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      messages
    };

    this.logs.unshift(entry);
    
    // Limit size
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }

    this.persist();
    this.notify();
  }

  private persist() {
      try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
      } catch (e) {
          // LocalStorage full or unavailable
          this.originalConsole.error('Logger failed to save to LS', e);
      }
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    listener(this.logs);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.logs));
  }

  clear() {
    this.logs = [];
    this.persist();
    this.notify();
  }
}

export const logger = new LoggerService();