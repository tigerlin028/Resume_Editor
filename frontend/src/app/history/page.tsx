'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HistoryList from '@/components/HistoryList';
import { useHistory } from '@/hooks/useHistory';
import { getSessionDetail } from '@/lib/api';

export default function HistoryPage() {
  const router = useRouter();
  const { items, total, page, loading, fetch, remove } = useHistory();

  useEffect(() => {
    fetch(1);
  }, [fetch]);

  const handleLoad = async (sessionId: number) => {
    try {
      const detail = await getSessionDetail(sessionId);
      // Store detail in sessionStorage and navigate to main page
      sessionStorage.setItem('loadedSession', JSON.stringify(detail));
      router.push('/');
    } catch {
      alert('加载失败，请重试');
    }
  };

  const handleDelete = async (sessionId: number) => {
    if (!confirm('确认删除这条记录？')) return;
    try {
      await remove(sessionId);
    } catch {
      alert('删除失败，请重试');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">历史记录</h1>
          </div>
          <span className="text-sm text-gray-400">共 {total} 条</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-400">加载中...</div>
        ) : (
          <>
            <HistoryList items={items} onLoad={handleLoad} onDelete={handleDelete} />

            {/* Pagination */}
            {total > 20 && (
              <div className="flex justify-center gap-2 mt-6">
                {page > 1 && (
                  <button
                    onClick={() => fetch(page - 1)}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    上一页
                  </button>
                )}
                <span className="px-4 py-2 text-sm text-gray-500">第 {page} 页</span>
                {total > page * 20 && (
                  <button
                    onClick={() => fetch(page + 1)}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    下一页
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
