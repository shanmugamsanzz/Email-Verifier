
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { LogEntry } from '../../types';
import { DocumentTextIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from '../../components/icons/IconComponents';

const SystemLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedLogs = await api.fetchSystemLogs();
      setLogs(fetchedLogs);
    } catch (error) {
      console.error("Failed to fetch system logs:", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getLogStyle = (level: 'ERROR' | 'WARNING' | 'INFO') => {
    switch (level) {
      case 'ERROR':
        return {
          icon: <XCircleIcon className="w-5 h-5 text-red-500" />,
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-500/30',
        };
      case 'WARNING':
        return {
          icon: <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />,
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-500/30',
        };
      case 'INFO':
        return {
          icon: <InformationCircleIcon className="w-5 h-5 text-blue-500" />,
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-500/30',
        };
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <DocumentTextIcon className="w-6 h-6 mr-2" />
        System Logs
      </h2>
      {loading ? (
        <p>Loading logs...</p>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const style = getLogStyle(log.level);
            return (
              <div key={log.id} className={`flex items-start p-3 border rounded-lg ${style.bgColor} ${style.borderColor}`}>
                <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
                <div className="ml-3 flex-1">
                  <p className="text-sm text-gray-800 dark:text-gray-200">{log.message}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SystemLogsPage;
