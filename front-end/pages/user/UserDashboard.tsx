
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useJobs } from '../../contexts/JobContext';
import { api } from '../../services/api';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { DashboardIcon } from '../../components/icons/IconComponents';
import JobUploader from '../../components/dashboard/JobUploader';
import JobList from '../../components/dashboard/JobList';
import SingleEmailValidator from '../../components/dashboard/SingleEmailValidator';

const userNavLinks = [
  { to: '/user', label: 'Dashboard', icon: DashboardIcon },
];

const UserDashboard: React.FC = () => {
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

  return (
    <DashboardLayout navLinks={userNavLinks} pageTitle="User Dashboard">
      <div className="space-y-6">
        <SingleEmailValidator onJobStarted={handleJobStarted} />
        <JobUploader 
          onJobsStarted={handleJobsStarted} 
        />
        <JobList 
          jobs={jobs}
          loading={isLoading}
          onAction={handleJobAction}
        />
      </div>
    </DashboardLayout>
  );
};

export default UserDashboard;