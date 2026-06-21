'use client';
import { useRef, useCallback, useState, useEffect } from 'react';
import DiffHighlight from './DiffHighlight';
import ResumePreview from './ResumePreview';
import type { DiffOp } from '@/types';

interface Props {
  originalText: string;
  optimizedText: string;
  diffOps: DiffOp[] | null;
  streaming?: boolean;
  hideDiff?: boolean;
  onTextChange?: (text: string) => void;
}

// Simple plain-text render for the original panel in diff mode
function PlainText({ text }: { text: string }) {
  return (
    <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-700">
      {text}
    </div>
  );
}

export default function ComparisonView({ originalText, optimizedText, diffOps, streaming, hideDiff, onTextChange }: Props) {
  const [mode, setMode] = useState<'preview' | 'diff'>('preview');
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(optimizedText);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  useEffect(() => {
    setEditedText(optimizedText);
    setIsEditing(false);
  }, [optimizedText]);

  const handleEdit = (val: string) => {
    setEditedText(val);
    onTextChange?.(val);
  };

  const onLeftScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (leftRef.current && rightRef.current) {
      const ratio = leftRef.current.scrollTop /
        Math.max(leftRef.current.scrollHeight - leftRef.current.clientHeight, 1);
      rightRef.current.scrollTop = ratio * (rightRef.current.scrollHeight - rightRef.current.clientHeight);
    }
    requestAnimationFrame(() => { syncing.current = false; });
  }, []);

  const onRightScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (leftRef.current && rightRef.current) {
      const ratio = rightRef.current.scrollTop /
        Math.max(rightRef.current.scrollHeight - rightRef.current.clientHeight, 1);
      leftRef.current.scrollTop = ratio * (leftRef.current.scrollHeight - leftRef.current.clientHeight);
    }
    requestAnimationFrame(() => { syncing.current = false; });
  }, []);

  const canDiff = !!diffOps && !streaming && !hideDiff;
  const hasEdits = editedText !== optimizedText;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => { setMode('preview'); setIsEditing(false); }}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === 'preview' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            PDF 预览
          </button>
          {!hideDiff && (
            <button
              onClick={() => { setMode('diff'); setIsEditing(false); }}
              disabled={!canDiff}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                mode === 'diff' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              对比改动
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {streaming && (
            <span className="text-xs bg-blue-100 text-blue-600 px-3 py-1 rounded-full animate-pulse">
              生成中...
            </span>
          )}
          {mode === 'diff' && canDiff && (
            <span className="text-xs text-gray-400">
              <span className="text-green-600">■</span> 新增 &nbsp;
              <span className="text-red-500">■</span> 删除
            </span>
          )}
          {mode === 'preview' && !streaming && (
            <button
              onClick={() => setIsEditing(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                isEditing
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {isEditing ? (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  完成编辑
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                  </svg>
                  {hasEdits ? '继续编辑' : '编辑'}
                </>
              )}
            </button>
          )}
          {hasEdits && !isEditing && mode === 'preview' && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">已手动编辑</span>
          )}
        </div>
      </div>

      {/* Content */}
      {mode === 'preview' ? (
        isEditing ? (
          /* Edit mode — raw markdown textarea */
          <div className="flex-1 min-h-0 bg-gray-200 rounded-lg p-4">
            <textarea
              value={editedText}
              onChange={e => handleEdit(e.target.value)}
              className="w-full h-full resize-none rounded border border-gray-300 p-4 text-xs leading-relaxed font-mono text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              spellCheck={false}
            />
          </div>
        ) : (
        /* PDF preview — single scrollable panel, page-like */
        <div className="flex-1 min-h-0 overflow-y-auto bg-gray-200 rounded-lg">
          <div className="py-6 px-4 flex justify-center">
            <div className="shadow-lg rounded w-full" style={{ maxWidth: '680px' }}>
              {streaming ? (
                <div style={{ fontFamily: '"Times New Roman", Times, serif', background: 'white', padding: '38px 44px' }}>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800" style={{ fontFamily: 'inherit' }}>
                    {optimizedText}
                  </pre>
                </div>
              ) : (
                <ResumePreview text={editedText} />
              )}
            </div>
          </div>
        </div>
        )
      ) : (
        /* Diff mode — two panels */
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
          <div className="flex flex-col min-h-0">
            <div className="text-xs text-gray-400 mb-1 px-1 shrink-0">原始版本</div>
            <div
              ref={leftRef}
              onScroll={onLeftScroll}
              className="flex-1 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50"
            >
              <PlainText text={originalText} />
            </div>
          </div>
          <div className="flex flex-col min-h-0">
            <div className="text-xs text-blue-400 mb-1 px-1 shrink-0">优化版本（改动高亮）</div>
            <div
              ref={rightRef}
              onScroll={onRightScroll}
              className="flex-1 overflow-y-auto border border-blue-200 rounded-lg p-4 bg-white"
            >
              {diffOps ? <DiffHighlight diffOps={diffOps} /> : (
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-800">
                  {optimizedText}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
