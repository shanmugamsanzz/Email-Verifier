
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Job, JobStatus } from '../../types';
import JobList from '../../components/dashboard/JobList';
import { useJobs } from '../../contexts/JobContext';

const JobMonitorPage: React.FC = () => {
  const { jobs, removeJob, isLoading } = useJobs(); // Admin gets all jobs from context
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'All'>('All');

  useEffect(() => {
    if (statusFilter === 'All') {
      setFilteredJobs(jobs);
    } else {
      setFilteredJobs(jobs.filter(job => job.status === statusFilter));
    }
  }, [statusFilter, jobs]);

  const handleAction = async (jobId: string, action: 'cancel' | 'close') => {
    if (action === 'cancel') {
        try {
            await api.cancelJob(jobId);
            // Polling will update the job status
        } catch (error) {
            console.error(`Failed to cancel job ${jobId}`, error);
        }
    }
    if (action === 'close') {
        removeJob(jobId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex justify-between items-center">
        <h2 className="text-lg font-semibold">All User Jobs</h2>
        <div>
          <label htmlFor="status-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
            Filter by status:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'All')}
            className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="All">All</option>
            {/* FIX: Use enum values for options instead of referring to the type. */}
            <option value={JobStatus.Running}>Running</option>
            <option value={JobStatus.Completed}>Completed</option>
            <option value={JobStatus.Failed}>Failed</option>
            <option value={JobStatus.Cancelled}>Cancelled</option>
          </select>
        </div>
      </div>
      
      <JobList jobs={filteredJobs} loading={isLoading} isAdminView={true} onAction={handleAction} />
    </div>
  );
};

export default JobMonitorPage;