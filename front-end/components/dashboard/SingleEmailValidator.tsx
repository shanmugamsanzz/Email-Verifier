import React, { useState } from 'react';
import { api } from '../../services/api';

interface SingleEmailValidatorProps {
  onJobStarted: (jobId: string) => void;
}

const SingleEmailValidator: React.FC<SingleEmailValidatorProps> = ({ onJobStarted }) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const validateEmailFormat = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter an email address.');
      return;
    }
    if (!validateEmailFormat(email)) {
      setError('Please enter a valid email format.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { job_id } = await api.startSingleJob(email);
      onJobStarted(job_id);
      setEmail('');
    } catch (err) {
      console.error('Failed to start single validation job:', err);
      setError(err instanceof Error ? err.message : 'Unable to start verification.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-2">Quick Validate</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Enter a single email address to start a validation job instantly.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-full">
            <input
            type="email"
            id="email-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder="e.g., contact@example.com"
            aria-label="Enter an email address"
            autoComplete="off"
            />
            {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto flex-shrink-0 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 disabled:bg-primary-400 dark:disabled:bg-primary-700/50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Validating...' : 'Validate'}
        </button>
      </form>
    </div>
  );
};

export default SingleEmailValidator;
