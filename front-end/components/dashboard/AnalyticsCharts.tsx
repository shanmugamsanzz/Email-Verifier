
import React, { useMemo } from 'react';
import { Job } from '../../types';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartBarIcon } from '../icons/IconComponents';

interface AnalyticsChartsProps {
  jobs: Job[];
}

const COLORS = ['#16a34a', '#dc2626']; // Green for valid, Red for invalid
const DOMAIN_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f97316'];

const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ jobs }) => {
  const aggregatedData = useMemo(() => {
    let totalValid = 0;
    let totalInvalid = 0;
    const domainCounts: Record<string, number> = {};

    jobs.forEach(job => {
      // FIX: Check if job.results exists before processing.
      if (job.results) {
        totalValid += job.results.valid;
        totalInvalid += job.results.invalid;
        Object.entries(job.results.domainCounts).forEach(([domain, count]) => {
          domainCounts[domain] = (domainCounts[domain] || 0) + count;
        });
      }
    });
    
    const pieData = [
      { name: 'Valid Emails', value: totalValid },
      { name: 'Invalid Emails', value: totalInvalid },
    ];

    const barData = Object.entries(domainCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, value]) => ({ name, count: value }));

    return { pieData, barData, totalEmails: totalValid + totalInvalid };
  }, [jobs]);

  if (aggregatedData.totalEmails === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4 flex items-center"><ChartBarIcon className="w-6 h-6 mr-2"/> Job Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-medium text-center mb-2">Valid vs. Invalid Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={aggregatedData.pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={110}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {aggregatedData.pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => value.toLocaleString()} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
            <h3 className="text-lg font-medium text-center mb-2">Top 5 Email Domains</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={aggregatedData.barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.2)" />
                    <XAxis dataKey="name" tick={{ fill: '#6b7280' }} className="text-xs" />
                    <YAxis tick={{ fill: '#6b7280' }} className="text-xs" />
                    <Tooltip cursor={{fill: 'rgba(243, 244, 246, 0.5)'}} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                        {aggregatedData.barData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={DOMAIN_COLORS[index % DOMAIN_COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
