'use client';
import { useState, useRef } from 'react';
import type { SessionSummary } from '@/types';

interface Props {
  items: SessionSummary[];
  onLoad: (sessionId: number) => void;
  onDelete: (sessionId: number) => void;
  onRename: (sessionId: number, title: string) => Promise<void>;
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

function EditableTitle({ id, title, onRename }: { id: number; title: string; onRename: (id: number, title: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setValue(title);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(id, trimmed);
    } catch {
      alert('重命名失败，请重试');
      setValue(title);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') { setValue(title); setEditing(false); }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
        disabled={saving}
        className="text-sm font-medium text-gray-800 border-b border-blue-400 outline-none bg-transparent w-full"
      />
    );
  }

  return (
    <span className="flex items-center gap-1 group/title min-w-0">
      <span className="text-sm font-medium text-gray-800 truncate">{title}</span>
      <button
        onClick={startEdit}
        className="shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
        title="重命名"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
        </svg>
      </button>
    </span>
  );
}

export default function HistoryList({ items, onLoad, onDelete, onRename }: Props) {
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
        <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors group">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <EditableTitle id={item.id} title={item.title} onRename={onRename} />
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
