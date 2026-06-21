'use client';
import { useState, useCallback } from 'react';
import { listHistory, deleteSession, renameSession } from '@/lib/api';
import type { SessionSummary } from '@/types';

export function useHistory() {
  const [items, setItems] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await listHistory(p);
      setItems(res.items);
      setTotal(res.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (sessionId: number) => {
    await deleteSession(sessionId);
    setItems(prev => prev.filter(i => i.id !== sessionId));
    setTotal(prev => prev - 1);
  }, []);

  const rename = useCallback(async (sessionId: number, title: string) => {
    await renameSession(sessionId, title);
    setItems(prev => prev.map(i => i.id === sessionId ? { ...i, title } : i));
  }, []);

  return { items, total, page, loading, fetch, remove, rename };
}
