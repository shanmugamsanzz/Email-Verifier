
export enum Role {
  Admin = 'Admin',
  Premium = 'Premium',
  User = 'User',
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  createdAt: string;
  uploadLimit: number;
}

export interface SMTPAccount {
  id: string;
  email: string;
  host: string;
  port: number;
  status: 'Active' | 'Failed';
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
}

export enum JobStatus {
  Running = 'Running',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
}

export interface Job {
  id: string;
  fileName: string;
  status: JobStatus;
  progress: number;
  submittedAt: string;
  logs?: string[];
  downloadUrls?: {
    all?: string | null;
    valid?: string | null;
    undeliverable?: string | null;
  };
  results?: {
    valid: number;
    invalid: number;
    domainCounts: Record<string, number>;
  };
  userId?: string;
  userEmail?: string;
}
