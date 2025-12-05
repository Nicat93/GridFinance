
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
      if (typeof arg === 'object') {
        try {
            // Simple truncation for objects to save space
            const str = JSON.stringify(arg);
            return str.length > 300 ? str.substring(0, 300) + '...' : str;
        } catch (e) {
          return '[Object]';
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
