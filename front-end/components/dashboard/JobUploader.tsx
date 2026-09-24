import React, { useState, useEffect, DragEvent } from 'react';
import { api, UploadStatus } from '../../services/api';
import { UploadCloudIcon, DocumentTextIcon, XCircleIcon } from '../icons/IconComponents';
import { useJobs } from '../../contexts/JobContext';
import { JobStatus } from '../../types';
import * as XLSX from 'xlsx';

interface JobUploaderProps {
  onJobsStarted: (jobIds: string[]) => void;
}

// Use the centralized `api` helper for requests; removes hardcoded localhost

const JobUploader: React.FC<JobUploaderProps> = ({ onJobsStarted }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [latestUpload, setLatestUpload] = useState<{ fileName: string; jobIds: string[] } | null>(null);

  const { jobs } = useJobs();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const refresh = () => api.uploadStatus().then(status => {
      if (mounted) setUploadStatus(status);
    }).catch(error => {
      if (mounted) { setUploadStatus(null); setError(error.message); }
    });
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // Parse emails from file (CSV, TXT, XLS/XLSX)
  const parseEmailsFromFile = (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'xls' || fileExtension === 'xlsx') {
        reader.onload = (event) => {
          try {
            const data = event.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            let emails: string[] = [];
            workbook.SheetNames.forEach((sheetName: string) => {
              const worksheet = workbook.Sheets[sheetName];
              const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
              json.forEach(row => {
                if (Array.isArray(row)) {
                  row.forEach(cell => {
                    if (typeof cell === 'string') {
                      const foundEmails = cell.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
                      if (foundEmails) emails.push(...foundEmails);
                    }
                  });
                }
              });
            });
            resolve([...new Set(emails)]);
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            const emails = content.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi) || [];
            resolve([...new Set(emails)]);
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
      }
    });
  };


  // File handlers
  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.size > 10 * 1024 * 1024) {
      setError('Maximum file size is 10 MB.');
      return;
    }
    setError('');
    if (selectedFile) setFile(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFileSelect(e.target.files[0]);
    e.target.value = '';
  };

  const handleDragEvents = (e: DragEvent<HTMLDivElement>, action: 'enter' | 'leave' | 'over') => {
    e.preventDefault();
    e.stopPropagation();
    if (action === 'enter' || action === 'over') setIsDragging(true);
    else setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !isUploadDisabled) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Upload & start validation
  const handleUpload = async () => {
    if (!file || isSubmitting || isUploadDisabled) return;

    setIsSubmitting(true);
    setError('');
    const currentFile = file;
    try {
      const emails = await parseEmailsFromFile(currentFile);
      if (emails.length === 0) {
        alert('No valid emails found in the file.');
        setIsSubmitting(false);
        setFile(null);
        return;
      }

      const currentStatus = await api.uploadStatus();
      setUploadStatus(currentStatus);
      if (currentStatus.activeJobId) throw new Error('Your previous upload is still processing.');
      if (emails.length > currentStatus.uploadLimit) {
        throw new Error(`Your limit is ${currentStatus.uploadLimit} emails. This file contains ${emails.length}.`);
      }
      const result = await api.startBulkBatchJob(emails);
      const jobIds = [result.job_id];
      setUploadStatus({ ...currentStatus, activeJobId: result.job_id });

      onJobsStarted(jobIds);
      setLatestUpload({ fileName: currentFile.name, jobIds });
      setFile(null);
    } catch (error) {
      console.error('Failed to parse file or start bulk jobs:', error);
      setError(error instanceof Error ? error.message : 'Unable to start upload.');
      setLatestUpload(null);
    }
    setIsSubmitting(false);
  };

  const handleNewUpload = () => setLatestUpload(null);

  // 🧩 NEW: Combine all verified files into one CSV
  const handleDownloadAll = async () => {
    if (!latestUpload) return;
    try {
      const blob = await api.combineResults(latestUpload.jobIds);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${latestUpload.fileName.replace(/\.[^/.]+$/, '')}_ALL.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading combined results:', err);
      alert('Unable to combine results. Please try again.');
    }
  };

  // Check if upload should be disabled (jobs still processing)
  const relevantJobs = latestUpload ? jobs.filter(job => latestUpload.jobIds.includes(job.id)) : [];
  const isUploadDisabled = !uploadStatus || !!uploadStatus.activeJobId || !!(latestUpload && relevantJobs.length > 0 && !relevantJobs.every(job =>
    job.status === JobStatus.Completed || job.status === JobStatus.Failed || job.status === JobStatus.Cancelled
  ));

  // Render
  if (latestUpload) {
    const isFinished = relevantJobs.length > 0 && relevantJobs.every(job =>
      job.status === JobStatus.Completed || job.status === JobStatus.Failed || job.status === JobStatus.Cancelled
    );
    const isCompletedSuccessfully = relevantJobs.every(job => job.status === JobStatus.Completed);

    const overallStatusText = isFinished
      ? isCompletedSuccessfully ? 'Validation Completed' : 'Finished with Errors/Cancellations'
      : 'Processing...';

    const statusColorClass = isFinished
      ? isCompletedSuccessfully ? 'text-green-500' : 'text-red-500'
      : 'text-blue-500';

    const totalProgress = relevantJobs.reduce((acc, job) => acc + job.progress, 0);
    const averageProgress = relevantJobs.length > 0 ? totalProgress / relevantJobs.length : 0;

    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">
          Processing: <span className="font-bold">{latestUpload.fileName}</span>
        </h2>

        {relevantJobs.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-600 dark:text-gray-400">Initializing validation jobs...</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-grow bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-primary-600 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${averageProgress}%` }}
                ></div>
              </div>
              <span className="font-bold text-lg">{Math.round(averageProgress)}%</span>
            </div>

            <div className="text-center">
              <p className={`font-semibold text-lg ${statusColorClass}`}>{overallStatusText}</p>

              {isFinished && (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    ✅ Validation complete. You can now download the full combined results below.
                  </p>
                  <button
                    onClick={handleDownloadAll}
                    className="mt-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300"
                  >
                    Download All Results (Combined)
                  </button>
                </>
              )}
            </div>
          </>
        )}

        <button
          onClick={handleNewUpload}
          disabled={isUploadDisabled}
          className={`w-full mt-6 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ${
            isUploadDisabled ? 'bg-gray-400 dark:bg-gray-500 cursor-not-allowed' : ''
          }`}
        >
          {isUploadDisabled ? 'Processing Ongoing...' : 'Upload Another File'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-1">Upload Email List</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Maximum emails per upload: {uploadStatus?.uploadLimit.toLocaleString() ?? 'Loading...'}
      </p>
      {error && <p role="alert" className="text-red-600 mb-4">{error}</p>}
      {uploadStatus?.activeJobId && <p role="status" className="mb-4">An upload is processing. New uploads will be available when it finishes.</p>}

      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-300 ${
          isDragging && !isUploadDisabled
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        } ${isUploadDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragEnter={(e) => !isUploadDisabled && handleDragEvents(e, 'enter')}
        onDragLeave={(e) => !isUploadDisabled && handleDragEvents(e, 'leave')}
        onDragOver={(e) => !isUploadDisabled && handleDragEvents(e, 'over')}
        onDrop={handleDrop}
      >
        <input
          id="file-upload"
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept=".csv,.txt,.xls,.xlsx"
          disabled={isUploadDisabled}
        />

        {!file ? (
          <label
            htmlFor="file-upload"
            className={`flex flex-col items-center space-y-2 ${
              isUploadDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <UploadCloudIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {isUploadDisabled
                ? 'Please wait until current jobs are completed'
                : 'Click to upload or drag and drop'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              CSV, TXT, or Excel files
            </span>
          </label>
        ) : (
          <div className="flex flex-col items-center space-y-2 text-gray-700 dark:text-gray-300">
            <DocumentTextIcon className="w-12 h-12" />
            <span className="font-medium">{file.name}</span>
            <button
              onClick={() => setFile(null)}
              className="flex items-center text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-semibold"
            >
              <XCircleIcon className="w-4 h-4 mr-1" />
              Remove file
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || isSubmitting || isUploadDisabled}
        className={`w-full mt-6 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ${
          !file || isSubmitting || isUploadDisabled ? 'bg-gray-400 dark:bg-gray-500 cursor-not-allowed' : ''
        }`}
      >
        {isSubmitting ? 'Starting Jobs...' : isUploadDisabled ? 'Processing Ongoing...' : 'Start Validation Job(s)'}
      </button>
    </div>
  );
};

export default JobUploader;
