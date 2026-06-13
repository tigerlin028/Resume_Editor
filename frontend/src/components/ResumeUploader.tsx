'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadResume } from '@/lib/api';
import type { ResumeUploadResponse } from '@/types';

interface Props {
  onUploaded: (res: ResumeUploadResponse) => void;
}

export default function ResumeUploader({ onUploaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await uploadResume(file);
      setUploaded(file.name);
      onUploaded(res);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '上传失败，请重试';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [onUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: false,
    disabled: loading,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
          ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {loading ? (
            <p className="text-gray-500">正在解析简历...</p>
          ) : uploaded ? (
            <div>
              <p className="text-green-600 font-medium">✓ {uploaded}</p>
              <p className="text-sm text-gray-400 mt-1">点击或拖拽可重新上传</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 font-medium">
                {isDragActive ? '释放以上传' : '拖拽简历到此处，或点击选择文件'}
              </p>
              <p className="text-sm text-gray-400 mt-1">支持 PDF、Word (.docx) 格式</p>
            </div>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
