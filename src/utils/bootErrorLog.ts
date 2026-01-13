export type BootErrorEntry = {
  ts: number;
  type: 'error' | 'unhandledrejection';
  message: string;
  stack?: string;
};

const STORAGE_KEY = 'boot_errors_v1';
const MAX_ENTRIES = 50;

const safeRead = (): BootErrorEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as BootErrorEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const safeWrite = (entries: BootErrorEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // ignore
  }
};

export const addBootError = (entry: BootErrorEntry) => {
  const entries = safeRead();
  entries.push(entry);
  safeWrite(entries);
};

export const getBootErrors = (): BootErrorEntry[] => safeRead();

export const clearBootErrors = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const exportBootErrorsText = (): string => {
  const entries = safeRead();
  if (entries.length === 0) return 'No boot errors recorded.';

  return entries
    .map((e) => {
      const time = new Date(e.ts).toISOString();
      return [
        `# ${time} (${e.type})`,
        e.message,
        e.stack ? `\n${e.stack}` : '',
        '\n---\n',
      ].join('\n');
    })
    .join('\n');
};

export const installBootErrorHandlers = () => {
  // Avoid double-installation in HMR / repeated mounts
  if ((window as any).__bootErrorHandlersInstalled) return;
  (window as any).__bootErrorHandlersInstalled = true;

  window.addEventListener('error', (event) => {
    addBootError({
      ts: Date.now(),
      type: 'error',
      message: event.message || 'Unknown error',
      stack: (event.error && (event.error as any).stack) || undefined,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = (event as PromiseRejectionEvent).reason;
    addBootError({
      ts: Date.now(),
      type: 'unhandledrejection',
      message: reason?.message || String(reason) || 'Unhandled promise rejection',
      stack: reason?.stack,
    });
  });
};
