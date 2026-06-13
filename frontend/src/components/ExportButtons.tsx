'use client';
import { useState } from 'react';
import { exportPdf, exportDocx, getDownloadUrl } from '@/lib/api';

interface Props {
  optimizationId: number;
}

export default function ExportButtons({ optimizationId }: Props) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (type: 'pdf' | 'docx') => {
    const setLoading = type === 'pdf' ? setPdfLoading : setDocxLoading;
    setLoading(true);
    setError(null);
    try {
      const res = type === 'pdf' ? await exportPdf(optimizationId) : await exportDocx(optimizationId);
      const url = getDownloadUrl(res.download_url);
      const a = document.createElement('a');
      a.href = url;
      a.download = `optimized_resume.${type}`;
      a.click();
    } catch {
      setError('导出失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => handleExport('pdf')}
        disabled={pdfLoading}
        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg
          hover:bg-red-100 transition-colors disabled:opacity-50 text-sm font-medium"
      >
        {pdfLoading ? (
          <span className="animate-spin">⟳</span>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
        )}
        导出 PDF
      </button>
      <button
        onClick={() => handleExport('docx')}
        disabled={docxLoading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg
          hover:bg-blue-100 transition-colors disabled:opacity-50 text-sm font-medium"
      >
        {docxLoading ? (
          <span className="animate-spin">⟳</span>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
        )}
        导出 Word
      </button>
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
}
