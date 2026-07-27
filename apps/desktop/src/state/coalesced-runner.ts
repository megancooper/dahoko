type Waiter = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

/**
 * Runs one operation at a time and batches requests that arrive before the
 * next run begins. Requests made during a run are handled by one trailing run,
 * so every caller observes work completed after its request.
 */
export function createCoalescedRunner(operation: () => Promise<void>) {
  let running = false;
  let waiters: Waiter[] = [];

  const drain = async () => {
    try {
      while (waiters.length > 0) {
        const batch = waiters;
        waiters = [];

        try {
          await operation();
          for (const waiter of batch) waiter.resolve();
        } catch (error) {
          for (const waiter of batch) waiter.reject(error);
        }
      }
    } finally {
      running = false;
      if (waiters.length > 0) start();
    }
  };

  const start = () => {
    if (running) return;
    running = true;
    queueMicrotask(() => void drain());
  };

  return () =>
    new Promise<void>((resolve, reject) => {
      waiters.push({ resolve, reject });
      start();
    });
}
