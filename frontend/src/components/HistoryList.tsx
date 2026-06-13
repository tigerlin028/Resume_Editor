'use client';
import type { SessionSummary } from '@/types';

interface Props {
  items: SessionSummary[];
  onLoad: (sessionId: number) => void;
  onDelete: (sessionId: number) => void;
}

const STATUS_LABELS: Record<string, string> = {
  completed: '已完成',
  processing: '处理中',
  failed: '失败',
  pending: '等待中',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-gray-100 text-gray-600',
};

export default function HistoryList({ items, onLoad, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>暂无历史记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[item.status] || STATUS_COLORS.pending}`}>
                  {STATUS_LABELS[item.status] || item.status}
                </span>
                <span className="text-xs text-gray-400">
                  {item.optimization_count} 个版本
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(item.created_at).toLocaleString('zh-CN')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onLoad(item.id)}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                重新加载
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="text-sm text-red-400 hover:text-red-500 hover:underline"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
