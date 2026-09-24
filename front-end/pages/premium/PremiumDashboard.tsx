
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Job } from '../../types';
import { api } from '../../services/api';
import { useJobs } from '../../contexts/JobContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { DashboardIcon } from '../../components/icons/IconComponents';
import JobUploader from '../../components/dashboard/JobUploader';
import JobList from '../../components/dashboard/JobList';
import AnalyticsCharts from '../../components/dashboard/AnalyticsCharts';
import SingleEmailValidator from '../../components/dashboard/SingleEmailValidator';

const premiumNavLinks = [
  { to: '/premium', label: 'Dashboard', icon: DashboardIcon },
];

const PremiumDashboard: React.FC = () => {
  const { user } = useAuth();
  const { jobs, addJob, addJobs, removeJob, isLoading } = useJobs();

  const handleJobStarted = (jobId: string) => {
    if (user) {
      addJob(jobId, 'Single Email Validation', user.id);
    }
  };

  const handleJobsStarted = (jobIds: string[]) => {
    if (user) {
      addJobs(jobIds, 'Bulk Validation', user.id);
    }
  };

  const handleJobAction = async (jobId: string, action: 'cancel' | 'close') => {
    if (action === 'cancel') {
        try {
            await api.cancelJob(jobId);
            // Polling from JobContext will update the job status.
        } catch (error) {
            console.error(`Failed to cancel job ${jobId}`, error);
        }
    } else if (action === 'close') {
        removeJob(jobId);
    }
  };

  const completedJobs = jobs.filter(job => job.status === 'Completed' && job.results);

  return (
    <DashboardLayout navLinks={premiumNavLinks} pageTitle="Premium Dashboard">
      <div className="space-y-6">
        <SingleEmailValidator onJobStarted={handleJobStarted} />
        <JobUploader 
          onJobsStarted={handleJobsStarted} 
        />
        {completedJobs.length > 0 && <AnalyticsCharts jobs={completedJobs} />}
        <JobList 
          jobs={jobs}
          loading={isLoading}
          onAction={handleJobAction}
        />
      </div>
    </DashboardLayout>
  );
};

export default PremiumDashboard;