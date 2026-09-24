import React from 'react';
import { Job } from '../../types';
import { api, API_BASE_URL, authHeaders } from '../../services/api';
import { DownloadIcon } from '../icons/IconComponents';


// 🔹 Helper: download file with API key
const downloadFile = async (url: string, fileName: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      headers: {
        ...authHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error("File download error:", error);
    alert("Failed to download file.");
  }
};

// FIX: Add isAdminView prop to JobRow props
const JobRow: React.FC<{ job: Job; onAction: (id: string, action: 'cancel' | 'close') => void; isAdminView?: boolean }> = ({ job, onAction, isAdminView }) => {
  const [expanded, setExpanded] = React.useState(false);

  const getStatusPill = (status: Job['status']) => {
    const baseClasses = "px-3 py-1 text-xs font-semibold rounded-full";
    switch (status) {
      case 'Running': return `bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 ${baseClasses}`;
      case 'Completed': return `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 ${baseClasses}`;
      case 'Failed': return `bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 ${baseClasses}`;
      case 'Cancelled': return `bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 ${baseClasses}`;
    }
  };

  const handleCancel = async () => {
    try {
        await api.cancelJob(job.id);
    } catch (error) {
        console.error(`Failed to cancel job ${job.id}`, error);
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm transition-shadow hover:shadow-md">
      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div className="flex-1 min-w-0 pr-4" onClick={() => job.status === 'Running' && setExpanded(!expanded)} style={{ cursor: job.logs && job.logs.length > 0 ? 'pointer' : 'default' }}>
          <p className="font-semibold text-gray-800 dark:text-white truncate">{job.fileName}</p>
          {isAdminView && job.userEmail ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">User: {job.userEmail} | Job ID: {job.id}</p>
          ) : (
             isAdminView && job.userId ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">User ID: {job.userId} | Job ID: {job.id}</p>
            ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Job ID: {job.id}</p>
            )
          )}
        </div>
        <div className="flex-1 w-full md:w-auto">
          {job.status === 'Running' && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: `${job.progress}%` }}></div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between md:justify-end md:space-x-4 md:w-72">
           <div className="w-28 text-center">
             <span className={getStatusPill(job.status)}>{job.status}</span>
             {job.status === 'Running' && <span className="text-sm ml-2 font-medium">{job.progress}%</span>}
           </div>
           
           <div className="flex items-center space-x-2">
            {job.status === 'Completed' && (
                <div className="flex items-center space-x-2">
                    {job.downloadUrls?.all && (
                      <button 
                        onClick={() => downloadFile(job.downloadUrls.all, `${job.fileName}-all.csv`)} 
                        className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:underline">
                          All
                      </button>
                    )}
                    {job.downloadUrls?.valid && (
                      <button 
                        onClick={() => downloadFile(job.downloadUrls.valid, `${job.fileName}-valid.csv`)} 
                        className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline">
                          Valid
                      </button>
                    )}
                    {job.downloadUrls?.undeliverable && (
                      <button 
                        onClick={() => downloadFile(job.downloadUrls.undeliverable, `${job.fileName}-invalid.csv`)} 
                        className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                          Invalid
                      </button>
                    )}
                </div>
            )}
            {job.status === 'Running' && <button onClick={handleCancel} className="text-red-500 hover:text-red-700 font-medium text-sm">Cancel</button>}
            {(job.status === 'Completed' || job.status === 'Cancelled' || job.status === 'Failed') && (
                <button onClick={() => onAction(job.id, 'close')} className="text-gray-500 hover:text-gray-700 font-medium text-sm">Close</button>
            )}
           </div>
        </div>
      </div>
      {expanded && job.logs && job.logs.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
             <h4 className="font-semibold text-sm mb-2 text-gray-700 dark:text-gray-300">Recent Logs:</h4>
             <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400 font-mono max-h-40 overflow-y-auto">
                 {job.logs.slice().reverse().map((log, index) => ( <li key={index}>{log}</li> ))}
             </ul>
          </div>
      )}
    </div>
  );
};

// FIX: Add loading and isAdminView props to JobListProps
interface JobListProps {
  jobs: Job[];
  onAction: (id: string, action: 'cancel' | 'close') => void;
  loading?: boolean;
  isAdminView?: boolean;
}

const JobList: React.FC<JobListProps> = ({ jobs, onAction, loading, isAdminView }) => {
  if (loading) {
    return (
      <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow">
        <p className="text-gray-500 dark:text-gray-400">Loading jobs...</p>
      </div>
    );
  }
  
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">My Jobs</h2>
      {jobs.length === 0 ? (
        <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow">
          <p className="text-gray-500 dark:text-gray-400">No jobs have been started.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Validate an email or upload a file to begin.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} onAction={onAction} isAdminView={isAdminView} />
          ))}
        </div>
      )}
    </div>
  );
};

export default JobList;
