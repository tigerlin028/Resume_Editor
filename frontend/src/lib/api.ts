import axios from 'axios';
import type {
  ResumeUploadResponse,
  OptimizeRequest,
  OptimizeStartResponse,
  OptimizationResult,
  HistoryListResponse,
  SessionDetail,
  ExportResponse,
  Profile,
} from '@/types';

const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api/v1`,
});

export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<ResumeUploadResponse>('/resumes/upload', form);
  return data;
}

export async function startOptimization(req: OptimizeRequest): Promise<OptimizeStartResponse> {
  const { data } = await api.post<OptimizeStartResponse>('/optimize', req);
  return data;
}

export function createOptimizationStream(sessionId: number): EventSource {
  return new EventSource(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/optimize/stream/${sessionId}`
  );
}

export async function getOptimization(optimizationId: number): Promise<OptimizationResult> {
  const { data } = await api.get<OptimizationResult>(`/optimize/${optimizationId}`);
  return data;
}

export async function listHistory(page = 1, limit = 20): Promise<HistoryListResponse> {
  const { data } = await api.get<HistoryListResponse>('/history', { params: { page, limit } });
  return data;
}

export async function getSessionDetail(sessionId: number): Promise<SessionDetail> {
  const { data } = await api.get<SessionDetail>(`/history/${sessionId}`);
  return data;
}

export async function deleteSession(sessionId: number): Promise<void> {
  await api.delete(`/history/${sessionId}`);
}

export async function exportPdf(optimizationId: number): Promise<ExportResponse> {
  const { data } = await api.post<ExportResponse>(`/export/${optimizationId}/pdf`);
  return data;
}

export async function exportDocx(optimizationId: number): Promise<ExportResponse> {
  const { data } = await api.post<ExportResponse>(`/export/${optimizationId}/docx`);
  return data;
}

export function getDownloadUrl(downloadPath: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}${downloadPath}`;
}

export async function getProfile(): Promise<Profile> {
  const { data } = await api.get<Profile>('/profile');
  return data;
}

export async function updateProfile(structured_text: string): Promise<Profile> {
  const { data } = await api.put<Profile>('/profile', { structured_text });
  return data;
}

export async function addProfileText(text: string): Promise<Profile> {
  const { data } = await api.post<Profile>('/profile/add-text', { text });
  return data;
}

export async function startSessionFromProfile(): Promise<ResumeUploadResponse> {
  const { data } = await api.post<ResumeUploadResponse>('/profile/start-session');
  return data;
}
