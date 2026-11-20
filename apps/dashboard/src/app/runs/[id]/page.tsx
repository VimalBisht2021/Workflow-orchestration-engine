'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  Workflow, 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  ArrowLeft, 
  Clock, 
  Zap, 
  Activity, 
  Eye, 
  RefreshCw, 
  X,
  Code,
  Terminal,
  AlertTriangle
} from 'lucide-react';

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
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [runRes, tasksRes] = await Promise.all([
        fetch(`${API_URL}/workflow-runs/${id}`),
        fetch(`${API_URL}/workflow-runs/${id}/tasks`),
      ]);
      const runData = await runRes.json();
      const tasksData = await tasksRes.json();
      
      let eventsData: any[] = [];
      try {
        const eventsRes = await fetch(`${API_URL}/workflow-runs/${id}/events`);
        if (eventsRes.ok) {
          eventsData = await eventsRes.json();
        }
      } catch {
        eventsData = [];
      }

      setRun(runData);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setEvents(Array.isArray(eventsData) ? eventsData : []);

      // Update selectedTask if drawer is currently open
      setSelectedTask((prev: any) => {
        if (!prev) return null;
        const updated = (Array.isArray(tasksData) ? tasksData : []).find((t: any) => t.id === prev.id);
        return updated || prev;
      });

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
    if (status === 'CANCELLED') return <XCircle className="w-5 h-5 text-slate-400" />;
    if (status === 'SKIPPED') return <XCircle className="w-5 h-5 text-slate-300" />;
    return <RotateCcw className="w-5 h-5 text-amber-500 animate-spin" />;
  };

  const getStatusBg = (status: string) => {
    if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'FAILED') return 'bg-red-50 text-red-700 border-red-200';
    if (status === 'CANCELLED') return 'bg-slate-100 text-slate-500 border-slate-200';
    if (status === 'SKIPPED') return 'bg-slate-100 text-slate-400 border-slate-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const duration = run.startedAt && run.completedAt 
    ? ((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(2)
    : '-';

  const handleReplay = async () => {
    setIsReplaying(true);
    try {
      const res = await fetch(`${API_URL}/workflow-runs/${id}/replay`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(`Workflow run successfully replayed!\nNavigating to new execution: ${data.newRunId.split('-')[0]}`);
        window.location.href = `/runs/${data.newRunId}`;
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Replay failed: ${err.message || res.statusText}`);
      }
    } catch (e: any) {
      alert(`Replay request failed: ${e.message}`);
    } finally {
      setIsReplaying(false);
    }
  };

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const res = await fetch(`${API_URL}/workflow-runs/${id}/reconcile`, { method: 'POST' });
      if (res.ok) {
        await fetchData();
        alert('Reconciliation complete! Any finished remote tasks have been synchronized.');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Reconciliation error: ${err.message || res.statusText}`);
      }
    } catch (e: any) {
      alert(`Reconcile request failed: ${e.message}`);
    } finally {
      setIsReconciling(false);
    }
  };

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

      <main className="flex-1 max-w-6xl w-full mx-auto p-8 relative">
        <Link href="/runs" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Runs
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-900 font-mono">{run.id.split('-')[0]}</h1>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusBg(run.status)}`}>
                {getStatusIcon(run.status)}
                <span className="ml-2 font-semibold">{run.status}</span>
              </span>
              {isLive && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="relative flex h-2 w-2 mr-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  LIVE POLLING
                </span>
              )}
            </div>
            <p className="text-slate-500 flex items-center text-sm">
              <Workflow className="w-4 h-4 mr-1.5 text-indigo-600" /> Workflow ID: <span className="font-mono ml-1 text-slate-700">{run.workflowId.split('-')[0]}</span> 
              <span className="mx-2 text-slate-300">•</span> Version: <span className="font-mono text-slate-700">v{run.workflowVersion}</span>
              {run.replayedFromId && (
                <>
                  <span className="mx-2 text-slate-300">•</span>
                  <span className="text-indigo-600 font-medium">Replayed from {run.replayedFromId.split('-')[0]}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={handleReconcile}
              disabled={isReconciling}
              className="flex items-center px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isReconciling ? 'animate-spin' : ''}`} />
              Reconcile
            </button>
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
            <button 
              onClick={handleReplay}
              disabled={isReplaying || !TERMINAL_STATUSES.includes(run.status)}
              className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${isReplaying ? 'animate-spin' : ''}`} />
              Replay Workflow
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="text-sm font-medium text-slate-500 mb-1 flex items-center"><Clock className="w-4 h-4 mr-1.5 text-slate-400" /> Duration</div>
            <div className="text-2xl font-bold text-slate-900">{duration}s</div>
          </div>
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="text-sm font-medium text-slate-500 mb-1 flex items-center"><Zap className="w-4 h-4 mr-1.5 text-slate-400" /> Tasks Total</div>
            <div className="text-2xl font-bold text-slate-900">{tasks.length}</div>
          </div>
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="text-sm font-medium text-slate-500 mb-1 flex items-center"><Activity className="w-4 h-4 mr-1.5 text-slate-400" /> Completed Tasks</div>
            <div className="text-2xl font-bold text-emerald-600">{tasks.filter(t => t.status === 'COMPLETED').length} / {tasks.length}</div>
          </div>
        </div>

        {/* Visual DAG Execution Flow Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center">
            <Workflow className="w-4 h-4 mr-2 text-indigo-600" /> Execution Graph Progress
          </h2>
          <div className="flex flex-wrap gap-3">
            {tasks.map(t => (
              <div 
                key={t.id}
                onClick={() => setSelectedTask(t)}
                className={`flex items-center px-3.5 py-2 rounded-lg border cursor-pointer hover:shadow-md transition-all ${getStatusBg(t.status)}`}
              >
                <div className="mr-2">{getStatusIcon(t.status)}</div>
                <div>
                  <div className="text-xs font-bold text-slate-900">{t.taskDefinition?.name || t.id.split('-')[0]}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{t.taskDefinition?.handler || 'task'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task Runs Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Task Execution Details</h2>
            <span className="text-xs text-slate-400">Click any row or "Inspect" to view payloads</span>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-semibold">Task Name</th>
                <th className="px-6 py-4 font-semibold">Handler</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Duration</th>
                <th className="px-6 py-4 font-semibold text-right">Payloads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map(task => {
                const taskDuration = task.startedAt && task.completedAt
                  ? ((new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000).toFixed(2) + 's'
                  : (task.status === 'RUNNING' ? 'Running...' : '-');

                return (
                  <tr 
                    key={task.id} 
                    onClick={() => setSelectedTask(task)}
                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{task.taskDefinition?.name || task.id.split('-')[0]}</div>
                      <div className="font-mono text-xs text-slate-400">{task.id.split('-')[0]}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-600">
                      {task.taskDefinition?.handler || 'core/task'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold border ${getStatusBg(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-500">{taskDuration}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(task);
                        }}
                        className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded-md text-xs font-medium transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No task runs found for this execution.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Task Inspector Slide-over Drawer */}
        {selectedTask && (
          <>
            <div 
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTask(null);
              }}
            />
            <div 
              className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedTask.taskDefinition?.name || selectedTask.id.split('-')[0]}</h3>
                  <div className="text-xs font-mono text-slate-500 mt-1 flex items-center gap-2">
                    <span>ID: {selectedTask.id}</span>
                    <span>•</span>
                    <span>Handler: {selectedTask.taskDefinition?.handler}</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTask(null);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Status and Timings */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 block">Status:</span>
                    <span className={`inline-block mt-1 font-bold ${selectedTask.status === 'COMPLETED' ? 'text-emerald-600' : selectedTask.status === 'FAILED' ? 'text-red-600' : 'text-slate-800'}`}>
                      {selectedTask.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Execution Started:</span>
                    <span className="font-mono mt-1 block">
                      {selectedTask.startedAt ? new Date(selectedTask.startedAt).toLocaleTimeString() : 'Not started'}
                    </span>
                  </div>
                </div>

                {/* Error Banner if Failed */}
                {selectedTask.error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <div className="font-bold flex items-center mb-1">
                      <AlertTriangle className="w-4 h-4 mr-1.5 text-red-500" /> Error Details
                    </div>
                    <pre className="font-mono text-xs whitespace-pre-wrap">{selectedTask.error}</pre>
                  </div>
                )}

                {/* Input Payload */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center">
                    <Code className="w-4 h-4 mr-1.5 text-indigo-600" /> Input Payload
                  </h4>
                  <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto text-emerald-400 font-mono text-xs max-h-60">
                    <pre>{JSON.stringify(selectedTask.input, null, 2) || '// No input data'}</pre>
                  </div>
                </div>

                {/* Output Result */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center">
                    <Terminal className="w-4 h-4 mr-1.5 text-indigo-600" /> Output Result
                  </h4>
                  <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto text-blue-300 font-mono text-xs max-h-60">
                    <pre>{JSON.stringify(selectedTask.output, null, 2) || '// No output result'}</pre>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 text-right">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTask(null);
                  }}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-md text-sm font-medium transition-colors cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  );
}
