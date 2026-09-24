import { Job, JobStatus, User, Role, SMTPAccount, LogEntry } from '../types';


let MOCK_SMTP_ACCOUNTS: SMTPAccount[] = [
    { id: 'smtp-1', email: 'sender1@gmail.com', host: 'smtp.gmail.com', port: 587, status: 'Active' },
    { id: 'smtp-2', email: 'sender2@outlook.com', host: 'smtp.office365.com', port: 587, status: 'Active' },
    { id: 'smtp-3', email: 'backup@verifast.com', host: 'smtp.sendgrid.net', port: 587, status: 'Failed' },
];

const MOCK_LOGS: LogEntry[] = [
    { id: 'log-1', timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(), level: 'INFO', message: 'User premium@verifast.com logged in.' },
    { id: 'log-2', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), level: 'WARNING', message: 'SMTP account backup@verifast.com failed to connect 3 times.' },
    { id: 'log-3', timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), level: 'ERROR', message: 'Job job-3 failed: SMTP connection timeout.' },
    { id: 'log-4', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), level: 'INFO', message: 'System startup complete.' },
];

const DEFAULT_API_HOST = window.location.hostname === 'verifast.zeacrm.com'
  ? 'https://api.verifast.zeacrm.com'
  : `${window.location.protocol}//${window.location.hostname}:5000`;
// Cast `import.meta` to `any` to avoid TypeScript errors when the Vite
// environment types are not available in this project setup.
export const API_BASE_URL = ((import.meta as any)?.env?.VITE_API_BASE_URL || DEFAULT_API_HOST).replace(/\/+$/, '');
export const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

async function requestJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

export interface UploadStatus { uploadLimit: number; activeJobId: string | null }

export interface JobStatusResponse {
    progress: number;
    logs: string[];
    downloads?: {
        all: string | null;
        valid: string | null;
        undeliverable: string | null;
    };
    status: 'completed' | 'cancelled' | 'in-progress' | 'failed';
}

export const api = {
  login: (email: string, password: string) => requestJson<{ user: User; token: string }>('/auth/login', { email, password }),
  me: () => requestJson<User>('/auth/me'),
  uploadStatus: () => requestJson<UploadStatus>('/upload_status'),
  startSingleJob: async (email: string): Promise<{ job_id: string }> => {
    return requestJson('/start_single', { email });
  },

  startBulkBatchJob: async (emails: string[]): Promise<{ job_id: string }> => {
    return requestJson('/start_bulk_batch', { emails });
  },
  
  getJobStatus: async (jobId: string): Promise<JobStatusResponse> => {
    const response = await fetch(`${API_BASE_URL}/job_status/${jobId}`, {
      headers: {
        ...authHeaders()
      }
    });
    if (!response.ok) throw new Error(`Failed to get job status for ${jobId}.`);
    return response.json();
  },

  cancelJob: async (jobId: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE_URL}/cancel_job/${jobId}`, {
      method: 'POST',
      headers: {
        ...authHeaders()
      }
    });
    if (!response.ok) throw new Error(`Failed to cancel job ${jobId}.`);
    return response.json();
  },

  fetchUsers: async (): Promise<User[]> => {
    return requestJson('/admin/users');
  },
  
  updateUserRole: async (userId: string, newRole: Role): Promise<User> => {
    return requestJson(`/admin/users/${userId}`, { role: newRole });
  },

  addUser: async (newUser: { username: string; email: string; role: Role; password: string; uploadLimit: number }): Promise<User> => {
    return requestJson('/admin/users', newUser);
  },

  updateUser: async (userData: Pick<User, 'id' | 'username' | 'email' | 'uploadLimit'> & { password?: string }): Promise<User> => {
    return requestJson(`/admin/users/${userData.id}`, userData);
  },

  deleteUser: async (userId: string): Promise<{ success: boolean }> => {
    return requestJson(`/admin/users/${userId}/delete`, {});
  },

  fetchSmtpAccounts: async (): Promise<SMTPAccount[]> => {
      return new Promise(resolve => setTimeout(() => resolve(MOCK_SMTP_ACCOUNTS), 500));
  },
  
  addSmtpAccount: async (newAccount: { email: string; host: string; port: number }): Promise<SMTPAccount> => {
    return new Promise(resolve => setTimeout(() => {
        const account: SMTPAccount = {
            id: `smtp-${Date.now()}`,
            ...newAccount,
            status: 'Active',
        };
        MOCK_SMTP_ACCOUNTS.push(account);
        resolve(account);
    }, 500));
  },

  deleteSmtpAccount: async (id: string): Promise<{ success: boolean }> => {
    return new Promise(resolve => setTimeout(() => {
        const initialLength = MOCK_SMTP_ACCOUNTS.length;
        MOCK_SMTP_ACCOUNTS = MOCK_SMTP_ACCOUNTS.filter(acc => acc.id !== id);
        resolve({ success: MOCK_SMTP_ACCOUNTS.length < initialLength });
    }, 500));
  },

  fetchSystemLogs: async (): Promise<LogEntry[]> => {
    return new Promise(resolve => setTimeout(() => resolve(MOCK_LOGS.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())), 500));
  }
,

  // Combine multiple job result files into one CSV and return a Blob
  combineResults: async (jobIds: string[]): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/combine_results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ jobIds }),
    });
    if (!response.ok) throw new Error('Failed to combine results');
    const blob = await response.blob();
    return blob;
  }
};
