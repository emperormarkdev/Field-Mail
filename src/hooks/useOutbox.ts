import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { flushQueue, retryAll, retryOutboxItem } from '../lib/queue';

export function useOutbox() {
  const items = useLiveQuery(() => db.outbox.toArray(), [], []);

  const count = items.filter((item) => item.status !== 'sent').length;
  const failedCount = items.filter((item) => item.status === 'failed').length;

  const retry = useCallback(async () => {
    await retryAll();
  }, []);

  const retryOne = useCallback(async (id: string) => {
    await retryOutboxItem(id);
    await flushQueue();
  }, []);

  return { items, count, failedCount, retry, retryOne, flush: flushQueue };
}
