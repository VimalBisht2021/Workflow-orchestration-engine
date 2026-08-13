'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Workflow, CheckCircle, XCircle, RotateCcw, ArrowLeft, Clock, Zap, Activity } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'];

export default function RunDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [run, setRun] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [isLive, setIsLive] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [runRes, tasksRes, eventsRes] = await Promise.all([
        fetch(`${API_URL}/workflow-runs/${id}`),
        fetch(`${API_URL}/workflow-runs/${id}/tasks`),
        fetch(`${API_URL}/workflow-runs/${id}/events`),
      ]);
      const runData = await runRes.json();
      const tasksData = await tasksRes.json();
      const eventsData = await eventsRes.json();

      setRun(runData);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setEvents(Array.isArray(eventsData) ? eventsData : []);

      // Stop polling once the workflow reaches a terminal state
      if (TERMINAL_STATUSES.includes(runData?.status)) {
        setIsLive(false);
      }
    } catch (err) {
      console.error('Failed to fetch run data:', err);
    }
  }, [id]);

  // Initial fetch + polling
  useEffect(() => {
    fetchData();

    if (isLive) {
      timerRef.current = setInterval(fetchData, POLL_INTERVAL_MS);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id, isLive, fetchData]);

  if (!run) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <RotateCcw className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );

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

  const duration = run.startedAt && run.completedAt 
    ? ((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(2)
    : '-';

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
        <Link href="/runs" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Runs
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-900 font-mono">{run.id.split('-')[0]}</h1>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBg(run.status)}`}>
                {getStatusIcon(run.status)}
                <span className="ml-2">{run.status}</span>
              </span>
              {isLive && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="relative flex h-2 w-2 mr-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  LIVE
                </span>
              )}
            </div>
            <p className="text-slate-500 flex items-center">
              <Workflow className="w-4 h-4 mr-1.5" /> {run.workflowId.split('-')[0]} <span className="mx-2 text-slate-300">•</span> v{run.workflowVersion}
            </p>
          </div>
          <div className="flex space-x-3">
            {!TERMINAL_STATUSES.includes(run.status) && (
              <button 
                onClick={async () => {
                  if (confirm('Are you sure you want to stop this workflow?')) {
                    try {
                      await fetch(`${API_URL}/workflow-runs/${id}/cancel`, { method: 'POST' });
                      fetchData();
                    } catch (e) {
                      console.error('Failed to cancel workflow', e);
                    }
                  }
                }}
                className="flex items-center px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg font-medium shadow-sm transition-colors"
              >
                <XCircle className="w-4 h-4 mr-2" /> Stop
              </button>
            )}
            <button className="flex items-center px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium shadow-sm transition-colors">
              <RotateCcw className="w-4 h-4 mr-2" /> Replay
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="text-sm font-medium text-slate-500 mb-1 flex items-center"><Clock className="w-4 h-4 mr-1.5 text-slate-400" /> Duration</div>
            <div className="text-2xl font-bold text-slate-900">{duration}s</div>
          </div>
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="text-sm font-medium text-slate-500 mb-1 flex items-center"><Zap className="w-4 h-4 mr-1.5 text-slate-400" /> Tasks Executed</div>
            <div className="text-2xl font-bold text-slate-900">{tasks.length}</div>
          </div>
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="text-sm font-medium text-slate-500 mb-1 flex items-center"><Activity className="w-4 h-4 mr-1.5 text-slate-400" /> Events Emitted</div>
            <div className="text-2xl font-bold text-slate-900">{events.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-900">Task Runs</h2>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-semibold">Task ID</th>
                <th className="px-6 py-4 font-semibold">Node ID</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Attempt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map(task => (
                <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-slate-700">{task.id.split('-')[0]}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{task.nodeId}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBg(task.status)}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{task.attempt}</td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No tasks found.
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
