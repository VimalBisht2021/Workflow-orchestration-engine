'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Workflow, Search, Filter, RotateCcw, Clock, CheckCircle, XCircle } from 'lucide-react';

interface RunData {
  id: string;
  workflowId: string;
  workflowVersion: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<RunData[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/workflow-runs`)
      .then(res => res.json())
      .then(data => setRuns(data))
      .catch(console.error);
  }, []);

  const getStatusIcon = (status: string) => {
    if (status === 'COMPLETED') return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    if (status === 'FAILED') return <XCircle className="w-5 h-5 text-red-500" />;
    return <RotateCcw className="w-5 h-5 text-amber-500 animate-spin" />;
  };

  const getStatusBg = (status: string) => {
    if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700';
    if (status === 'FAILED') return 'bg-red-50 text-red-700';
    return 'bg-amber-50 text-amber-700';
  };

  const filtered = runs.filter(r => r.workflowId.includes(search) || r.id.includes(search));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <Workflow className="w-6 h-6 text-indigo-600" />
          <Link href="/" className="text-xl font-bold text-slate-800 hover:text-indigo-600 transition-colors">Workflow Studio</Link>
        </div>
        <div className="flex space-x-6 text-sm font-medium">
          <Link href="/workflows" className="text-slate-500 hover:text-slate-900">Workflows</Link>
          <Link href="/runs" className="text-indigo-600">Runs</Link>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl w-full mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Workflow Runs</h1>
            <p className="text-slate-500 mt-1">Monitor active executions and review historical runs.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search runs by ID or workflow ID..." 
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="flex items-center px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Filter className="w-4 h-4 mr-2 text-slate-400" /> Status
            </button>
            <button className="flex items-center px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Clock className="w-4 h-4 mr-2 text-slate-400" /> Last 24h
            </button>
          </div>
          
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-semibold">Run ID</th>
                <th className="px-6 py-4 font-semibold">Workflow</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Started</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(run => (
                <tr key={run.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/runs/${run.id}`} className="font-mono text-sm text-indigo-600 hover:underline">
                      {run.id.split('-')[0]}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{run.workflowId.split('-')[0]}</div>
                    <div className="text-xs text-slate-500 font-mono">v{run.workflowVersion}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBg(run.status)}`}>
                      {getStatusIcon(run.status)}
                      <span className="ml-1.5">{run.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {run.startedAt ? new Date(run.startedAt).toLocaleString() : 'Pending'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      href={`/runs/${run.id}`}
                      className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md text-sm font-medium transition-colors"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No runs found. Execute a workflow to see it here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
