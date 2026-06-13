export interface ResumeUploadResponse {
  resume_id: number;
  session_id: number;
  original_filename: string;
  file_type: string;
  parsed_text: string;
}

export interface OptimizeRequest {
  session_id: number;
  resume_id: number;
  jd_text: string;
  instructions?: string;
  parent_id?: number;
}

export interface OptimizeStartResponse {
  optimization_id: number;
  session_id: number;
}

export interface OptimizationResult {
  id: number;
  session_id: number;
  resume_id: number;
  jd_text: string;
  instructions?: string;
  optimized_text?: string;
  diff_json?: string;
  parent_id?: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_creation_tokens?: number;
  created_at: string;
}

export interface SessionSummary {
  id: number;
  title: string;
  status: string;
  created_at: string;
  optimization_count: number;
}

export interface SessionDetail {
  id: number;
  title: string;
  status: string;
  created_at: string;
  resume_id: number;
  resume_filename: string;
  parsed_text: string;
  optimizations: OptimizationResult[];
}

export interface HistoryListResponse {
  items: SessionSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface ExportResponse {
  export_id: number;
  download_url: string;
}

export interface DiffOp {
  op: 'equal' | 'insert' | 'delete' | 'replace';
  old: string;
  new: string;
}

export interface Profile {
  id: number;
  owner_name: string | null;
  structured_text: string;
  updated_at: string;
}
