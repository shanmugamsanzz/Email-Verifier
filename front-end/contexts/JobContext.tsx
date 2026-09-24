import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { Job, JobStatus, Role } from '../types';
import { api, JobStatusResponse } from '../services/api';
import { useAuth } from './AuthContext';

interface JobContextType {
  jobs: Job[];
  addJob: (jobId: string, fileName: string, userId: string) => void;
  addJobs: (jobIds: string[], fileName: string, userId: string) => void;
  removeJob: (jobId: string) => void;
  isLoading: boolean;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

const getStoredJobs = (): Job[] => {
    try {
        const item = localStorage.getItem('verifast_jobs');
        return item ? JSON.parse(item) : [];
    } catch (error) {
        console.error("Failed to parse jobs from localStorage", error);
        return [];
    }
};

export const JobProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [jobs, setJobs] = useState<Job[]>(getStoredJobs);
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        localStorage.setItem('verifast_jobs', JSON.stringify(jobs));
    }, [jobs]);
    
    useEffect(() => {
        setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const addJob = (jobId: string, fileName: string, userId: string) => {
        const newJob: Job = {
            id: jobId,
            fileName,
            userId,
            status: JobStatus.Running,
            progress: 0,
            submittedAt: new Date().toISOString(),
            logs: [],
        };
        setJobs(prev => [newJob, ...prev]);
    };
    
    const addJobs = (jobIds: string[], baseFileName: string, userId: string) => {
        const newJobs: Job[] = jobIds.map((id, index) => ({
            id,
            fileName: jobIds.length > 1 ? `${baseFileName} (Batch ${index + 1})` : baseFileName,
            userId,
            status: JobStatus.Running,
            progress: 0,
            submittedAt: new Date().toISOString(),
        }));
        setJobs(prev => [...newJobs, ...prev]);
    };

    const removeJob = (jobId: string) => {
        setJobs(prev => prev.filter(j => j.id !== jobId));
    };

    const pollJobStatuses = useCallback(async () => {
        if (!user) return;
        const runningJobs = jobs.filter(j => j.status === JobStatus.Running && (j.userId === user.id || user.role === Role.Admin));
        if (runningJobs.length === 0) return;

        const updates = await Promise.all(
            runningJobs.map(job =>
                api.getJobStatus(job.id).catch(err => {
                    console.error(`Failed to update job ${job.id}`, err);
                    const errorLogs = [...(job.logs || []), '[Error] Failed to fetch status.'];
                    return { status: 'failed', progress: job.progress, logs: errorLogs, downloads: job.downloadUrls } as JobStatusResponse;
                })
            )
        );

        setJobs(prevJobs =>
            prevJobs.map(job => {
                const runningIndex = runningJobs.findIndex(rj => rj.id === job.id);
                if (runningIndex > -1) {
                    const update = updates[runningIndex];
                    let newStatus: JobStatus;
                    switch (update.status) {
                        case 'completed': newStatus = JobStatus.Completed; break;
                        case 'cancelled': newStatus = JobStatus.Cancelled; break;
                        case 'failed': newStatus = JobStatus.Failed; break;
                        default: newStatus = JobStatus.Running;
                    }
                    
                    return {
                        ...job,
                        status: newStatus,
                        progress: update.progress,
                        logs: update.logs,
                        downloadUrls: update.downloads,
                    };
                }
                return job;
            })
        );
    }, [jobs, user]);

    useEffect(() => {
        const interval = setInterval(pollJobStatuses, 3000); // Poll every 3 seconds
        return () => clearInterval(interval);
    }, [pollJobStatuses]);

    const displayedJobs = useMemo(() => {
        if (!user) return [];
        if (user.role === Role.Admin) {
            // Admin sees all jobs from the session
            return jobs.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        }
        // Users see only their own jobs
        return jobs.filter(job => job.userId === user.id).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    }, [jobs, user]);

    return (
        <JobContext.Provider value={{ jobs: displayedJobs, addJob, addJobs, removeJob, isLoading }}>
            {children}
        </JobContext.Provider>
    );
};

export const useJobs = (): JobContextType => {
    const context = useContext(JobContext);
    if (context === undefined) {
        throw new Error('useJobs must be used within a JobProvider');
    }
    return context;
};
