export interface QueueProvider {
  name: string;
  enqueue(jobName: string, fn: () => Promise<void>): void;
}

class InProcessQueue implements QueueProvider {
  name = "in-process";
  enqueue(jobName: string, fn: () => Promise<void>): void {
    (async () => {
      try {
        await fn();
      } catch (e) {
        console.error(`[queue:${jobName}] failed`, e);
      }
    })();
  }
}

export function getQueue(): QueueProvider {
  return new InProcessQueue();
}
