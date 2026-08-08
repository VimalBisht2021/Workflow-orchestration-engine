'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Workflow, Plus, Search, Tag, User, Play, Edit3 } from 'lucide-react';

interface WorkflowData {
  id: string;
  name: string;
  version: string;
  status: string;
  createdAt: string;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/workflows`)
      .then(res => res.json())
      .then(data => setWorkflows(data))
      .catch(console.error);
  }, []);

  const handleExecute = async (id: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/workflows/${id}/execute`, {
        method: 'POST'
      });
      if (res.ok) {
        const run = await res.json();
        window.location.href = `/runs/${run.id}`;
      } else {
        alert('Failed to execute workflow');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = workflows.filter(w => w.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <Workflow className="w-6 h-6 text-indigo-600" />
          <Link href="/" className="text-xl font-bold text-slate-800 hover:text-indigo-600 transition-colors">Workflow Studio</Link>
        </div>
        <div className="flex space-x-6 text-sm font-medium">
          <Link href="/workflows" className="text-indigo-600">Workflows</Link>
          <Link href="/runs" className="text-slate-500 hover:text-slate-900">Runs</Link>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl w-full mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Workflows</h1>
            <p className="text-slate-500 mt-1">Manage, validate, and publish workflow definitions.</p>
          </div>
          <Link href="/studio" className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-colors">
            <Plus className="w-4 h-4 mr-2" />
            New Workflow
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search workflows by name..." 
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="flex items-center px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
              <User className="w-4 h-4 mr-2 text-slate-400" /> Owner
            </button>
            <button className="flex items-center px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Tag className="w-4 h-4 mr-2 text-slate-400" /> Tag
            </button>
          </div>
          
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-semibold">Workflow Name</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Version</th>
                <th className="px-6 py-4 font-semibold">Created</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(wf => (
                <tr key={wf.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-indigo-50 rounded flex items-center justify-center text-indigo-600 mr-3">
                        <Workflow className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-slate-900">{wf.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      wf.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' :
                      wf.status === 'VALIDATED' ? 'bg-blue-100 text-blue-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {wf.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-mono">{wf.version}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(wf.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {wf.status === 'PUBLISHED' && (
                      <button 
                        onClick={() => handleExecute(wf.id)}
                        className="inline-flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md text-sm font-medium transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 mr-1.5" /> Execute
                      </button>
                    )}
                    <Link 
                      href={`/studio/${wf.id}`}
                      className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md text-sm font-medium transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No workflows found. Create your first workflow in the Studio.
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
