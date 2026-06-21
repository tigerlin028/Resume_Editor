'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import ResumeUploader from '@/components/ResumeUploader';
import JDInput from '@/components/JDInput';
import InstructionBox from '@/components/InstructionBox';
import ComparisonView from '@/components/ComparisonView';
import ExportButtons from '@/components/ExportButtons';
import { useOptimize } from '@/hooks/useOptimize';
import { getProfile, startSessionFromProfile } from '@/lib/api';
import type { ResumeUploadResponse, DiffOp, Profile } from '@/types';

// ── Header ────────────────────────────────────────────────────────────────────
function Header({ onReset, showReset }: { onReset?: () => void; showReset?: boolean }) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shrink-0 z-10">
      <div className="flex items-center gap-2 flex-1">
        <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <span className="font-semibold text-gray-900 text-base">简历优化助手</span>
      </div>
      <div className="flex items-center gap-4">
        {showReset && onReset && (
          <button onClick={onReset} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            重新开始
          </button>
        )}
        <Link href="/profile" className="text-sm text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          个人档案
        </Link>
        <Link href="/history" className="text-sm text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          历史记录
        </Link>
      </div>
    </header>
  );
}

// ── Input page ────────────────────────────────────────────────────────────────
function InputPage({
  uploadResult, setUploadResult,
  jdText, setJdText,
  instructions, setInstructions,
  onOptimize, isWorking, error,
}: {
  uploadResult: ResumeUploadResponse | null;
  setUploadResult: (r: ResumeUploadResponse) => void;
  jdText: string; setJdText: (v: string) => void;
  instructions: string; setInstructions: (v: string) => void;
  onOptimize: () => void; isWorking: boolean; error: string | null;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usingProfile, setUsingProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then(p => {
      if (p.structured_text.trim()) setProfile(p);
    }).catch(() => {});
  }, []);

  const handleUseProfile = async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const result = await startSessionFromProfile();
      setUploadResult(result);
      setUsingProfile(true);
    } catch (e: unknown) {
      setProfileError(e instanceof Error ? e.message : '加载档案失败');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCancelProfile = () => {
    setUsingProfile(false);
    setUploadResult(null as unknown as ResumeUploadResponse);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Resume source panel */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">简历来源</h2>

            {!usingProfile ? (
              <>
                <ResumeUploader onUploaded={setUploadResult} />
                {profile && !uploadResult && (
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={handleUseProfile}
                      disabled={profileLoading}
                      className="w-full py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      {profileLoading ? '加载中...' : `使用已保存档案（${profile.owner_name ?? '个人档案'}）`}
                    </button>
                    {profileError && <p className="text-xs text-red-500 mt-1">{profileError}</p>}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm text-blue-700 font-medium">
                    {profile?.owner_name ?? '个人档案'}
                  </span>
                </div>
                <button
                  onClick={handleCancelProfile}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  改用上传文件
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <JDInput value={jdText} onChange={setJdText} disabled={isWorking} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <InstructionBox value={instructions} onChange={setInstructions} disabled={isWorking} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={onOptimize}
          disabled={!uploadResult || !jdText.trim() || isWorking}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-sm
            hover:bg-blue-700 active:bg-blue-800 transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isWorking ? '优化中...' : '开始优化简历'}
        </button>
      </div>
    </div>
  );
}

// ── Result page ───────────────────────────────────────────────────────────────
function ResultPage({
  uploadResult, optimizedText, diffOps, streaming,
  result, isWorking, error,
  adjustInstructions, setAdjustInstructions, onAdjust, hideDiff,
}: {
  uploadResult: ResumeUploadResponse;
  optimizedText: string;
  diffOps: DiffOp[] | null;
  streaming: boolean;
  result: { id: number; input_tokens?: number; output_tokens?: number; cache_read_tokens?: number } | null;
  isWorking: boolean; error: string | null;
  adjustInstructions: string;
  setAdjustInstructions: (v: string) => void;
  onAdjust: () => void;
  hideDiff: boolean;
}) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [editedText, setEditedText] = useState<string | null>(null);

  useEffect(() => { setEditedText(null); }, [optimizedText]);

  const handleTextChange = useCallback((text: string) => {
    setEditedText(text === optimizedText ? null : text);
  }, [optimizedText]);

  return (
    <>
      <div className="flex-1 min-h-0 px-6 pt-4 pb-2">
        <ComparisonView
          originalText={uploadResult.parsed_text}
          optimizedText={optimizedText}
          diffOps={diffOps}
          streaming={streaming}
          hideDiff={hideDiff}
          onTextChange={handleTextChange}
        />
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-3 space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          {result && <ExportButtons optimizationId={result.id} customText={editedText ?? undefined} />}
          {result && (
            <span className="text-xs text-gray-400 ml-auto">
              {result.input_tokens} 输入 / {result.output_tokens} 输出 tokens
              {result.cache_read_tokens ? ` · 缓存 ${result.cache_read_tokens}` : ''}
            </span>
          )}
        </div>

        {result && !streaming && (
          <div>
            <button
              onClick={() => setAdjustOpen(v => !v)}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <svg className={`w-4 h-4 transition-transform ${adjustOpen ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              继续调整
            </button>

            {adjustOpen && (
              <div className="mt-3 space-y-3">
                <InstructionBox
                  value={adjustInstructions}
                  onChange={setAdjustInstructions}
                  disabled={isWorking}
                  isAdjustment
                />
                {error && <div className="text-sm text-red-500">{error}</div>}
                <button
                  onClick={onAdjust}
                  disabled={!adjustInstructions.trim() || isWorking}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                    hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isWorking ? '调整中...' : '按指令重新生成'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function HomeContent() {
  const [uploadResult, setUploadResult] = useState<ResumeUploadResponse | null>(null);
  const [jdText, setJdText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [adjustInstructions, setAdjustInstructions] = useState('');

  const { status, streamText, result, error, optimize, reset, loadResult } = useOptimize();
  const isWorking = status === 'loading' || status === 'streaming';
  const hasResult = status === 'streaming' || !!result;

  // Restore session loaded from history page
  useEffect(() => {
    const raw = sessionStorage.getItem('loadedSession');
    if (!raw) return;
    sessionStorage.removeItem('loadedSession');
    try {
      const detail = JSON.parse(raw);
      const latestOpt = detail.optimizations?.[detail.optimizations.length - 1];
      if (!latestOpt) return;
      setUploadResult({
        session_id: detail.id,
        resume_id: detail.resume_id,
        original_filename: detail.resume_filename,
        file_type: 'pdf',
        parsed_text: detail.parsed_text,
      });
      setJdText(latestOpt.jd_text ?? '');
      loadResult(latestOpt);
    } catch {}
  }, [loadResult]);

  const handleOptimize = () => {
    if (!uploadResult || !jdText.trim()) return;
    optimize(uploadResult.session_id, uploadResult.resume_id, jdText, instructions || undefined);
  };

  const handleAdjust = () => {
    if (!uploadResult || !result) return;
    optimize(uploadResult.session_id, uploadResult.resume_id, jdText,
      adjustInstructions || undefined, result.id);
    setAdjustInstructions('');
  };

  const handleReset = () => {
    setUploadResult(null); setJdText(''); setInstructions('');
    setAdjustInstructions(''); reset();
  };

  const diffOps: DiffOp[] | null = result?.diff_json ? JSON.parse(result.diff_json) : null;
  const optimizedText = status === 'streaming' ? streamText : (result?.optimized_text || '');

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Header onReset={handleReset} showReset={hasResult} />

      {!hasResult ? (
        <InputPage
          uploadResult={uploadResult} setUploadResult={setUploadResult}
          jdText={jdText} setJdText={setJdText}
          instructions={instructions} setInstructions={setInstructions}
          onOptimize={handleOptimize} isWorking={isWorking} error={error}
        />
      ) : uploadResult && (
        <ResultPage
          uploadResult={uploadResult}
          optimizedText={optimizedText}
          diffOps={diffOps}
          streaming={status === 'streaming'}
          result={result}
          isWorking={isWorking}
          error={error}
          adjustInstructions={adjustInstructions}
          setAdjustInstructions={setAdjustInstructions}
          onAdjust={handleAdjust}
          hideDiff={uploadResult.file_type === 'profile'}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen bg-gray-50" />}>
      <HomeContent />
    </Suspense>
  );
}
