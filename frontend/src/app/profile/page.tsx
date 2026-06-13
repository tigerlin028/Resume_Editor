'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProfile, updateProfile, addProfileText } from '@/lib/api';
import type { Profile } from '@/types';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [addText, setAddText] = useState('');
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    getProfile().then(p => { setProfile(p); setEditText(p.structured_text); })
      .catch(() => setMessage({ type: 'err', text: '加载失败' }))
      .finally(() => setLoading(false));
  }, []);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const p = await updateProfile(editText);
      setProfile(p);
      setEditing(false);
      flash('ok', '已保存');
    } catch {
      flash('err', '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleAddText = async () => {
    if (!addText.trim()) return;
    setAdding(true);
    try {
      const p = await addProfileText(addText);
      setProfile(p);
      setEditText(p.structured_text);
      setAddText('');
      flash('ok', '已添加到档案');
    } catch {
      flash('err', '添加失败');
    } finally {
      setAdding(false);
    }
  };

  const isEmpty = !profile?.structured_text?.trim();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">个人档案</h1>
              {profile?.owner_name && (
                <p className="text-xs text-gray-400">{profile.owner_name}</p>
              )}
            </div>
          </div>
          {profile && !isEmpty && (
            <span className="text-xs text-gray-400">
              更新于 {new Date(profile.updated_at).toLocaleString('zh-CN')}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Status message */}
        {message && (
          <div className={`px-4 py-2 rounded-lg text-sm ${
            message.type === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">加载中...</div>
        ) : isEmpty ? (
          /* Empty state */
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">尚无档案</p>
            <p className="text-sm text-gray-400">上传简历后系统会自动建立档案，<br />或在下方直接输入你的经历</p>
          </div>
        ) : (
          /* Profile content */
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">档案内容</span>
              {!editing ? (
                <button
                  onClick={() => { setEditing(true); setEditText(profile!.structured_text); }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  编辑
                </button>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setEditing(false)} className="text-sm text-gray-400 hover:text-gray-600">取消</button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full p-5 font-mono text-sm text-gray-700 leading-relaxed resize-none focus:outline-none rounded-b-xl"
                rows={30}
              />
            ) : (
              <pre className="p-5 font-mono text-sm text-gray-700 leading-relaxed whitespace-pre-wrap overflow-auto max-h-[60vh]">
                {profile!.structured_text}
              </pre>
            )}
          </div>
        )}

        {/* Add text section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">补充经历 / 直接告诉档案</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              可以用自然语言描述，例如："我在XX公司做过项目经理，主导了XX产品上线"
            </p>
          </div>
          <textarea
            value={addText}
            onChange={e => setAddText(e.target.value)}
            placeholder="输入你想补充的内容..."
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={handleAddText}
            disabled={!addText.trim() || adding}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
              hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {adding ? '添加中...' : '添加到档案'}
          </button>
          <p className="text-xs text-gray-400">
            注：添加后会直接追加到"手动补充"区。下次上传简历时，Claude 会将全部内容整合进结构化档案。
          </p>
        </div>
      </main>
    </div>
  );
}
