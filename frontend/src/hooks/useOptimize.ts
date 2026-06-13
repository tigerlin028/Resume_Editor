'use client';
import { useState, useCallback } from 'react';
import { startOptimization, createOptimizationStream, getOptimization } from '@/lib/api';
import type { OptimizationResult } from '@/types';

type Status = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

export function useOptimize() {
  const [status, setStatus] = useState<Status>('idle');
  const [streamText, setStreamText] = useState('');
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const optimize = useCallback(async (
    sessionId: number,
    resumeId: number,
    jdText: string,
    instructions?: string,
    parentId?: number,
  ) => {
    setStatus('loading');
    setStreamText('');
    setError(null);

    try {
      const { optimization_id, session_id } = await startOptimization({
        session_id: sessionId,
        resume_id: resumeId,
        jd_text: jdText,
        instructions,
        parent_id: parentId,
      });

      setStatus('streaming');

      await new Promise<void>((resolve, reject) => {
        const es = createOptimizationStream(session_id);

        es.onmessage = (e) => {
          const event = JSON.parse(e.data);
          if (event.type === 'token') {
            setStreamText(prev => prev + event.content);
          } else if (event.type === 'done' || event.type === 'end') {
            es.close();
            resolve();
          } else if (event.type === 'error') {
            es.close();
            reject(new Error(event.message));
          }
        };

        es.onerror = () => {
          es.close();
          resolve(); // SSE closed after done — treat as complete
        };
      });

      const final = await getOptimization(optimization_id);
      setResult(final);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : '优化失败，请重试');
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setStreamText('');
    setResult(null);
    setError(null);
  }, []);

  const loadResult = useCallback((r: OptimizationResult) => {
    setResult(r);
    setStreamText('');
    setError(null);
    setStatus('done');
  }, []);

  return { status, streamText, result, error, optimize, reset, loadResult };
}
