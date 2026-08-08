import React from 'react';
import Link from 'next/link';
import { 
  Play, 
  CheckCircle, 
  Activity, 
  Layers, 
  Workflow, 
  ShieldCheck, 
  Zap, 
  GitBranch, 
  Clock 
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <Workflow className="w-6 h-6 text-indigo-600" />
          <span className="text-xl font-bold text-slate-800">Workflow Studio</span>
        </div>
        <div className="flex space-x-6 text-sm font-medium">
          <Link href="#architecture" className="text-slate-500 hover:text-slate-900">Architecture</Link>
          <Link href="#features" className="text-slate-500 hover:text-slate-900">Features</Link>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-900">GitHub</a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-8 py-20 max-w-6xl mx-auto text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 mb-6">
          Distributed Workflow <br /> Orchestration Engine
        </h1>
        <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
          A production-grade platform for building, executing, and monitoring complex distributed workflows. Features a visual designer, parallel execution, automatic retries, and full event-sourced replay capabilities.
        </p>
        <div className="flex justify-center space-x-4">
          <Link href="/studio" className="flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-colors">
            <Play className="w-4 h-4 mr-2" />
            Open Workflow Studio
          </Link>
          <Link href="/workflows" className="flex items-center px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium shadow-sm transition-colors">
            <Layers className="w-4 h-4 mr-2" />
            View Workflows
          </Link>
        </div>
      </section>

      {/* Metrics Summary */}
      <section className="px-8 py-12 bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center p-6 bg-slate-50 rounded-xl border border-slate-100">
            <Activity className="w-8 h-8 text-blue-500 mb-3" />
            <div className="text-3xl font-bold text-slate-900">142</div>
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-1">Total Runs</div>
          </div>
          <div className="flex flex-col items-center p-6 bg-slate-50 rounded-xl border border-slate-100">
            <CheckCircle className="w-8 h-8 text-emerald-500 mb-3" />
            <div className="text-3xl font-bold text-slate-900">94.2%</div>
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-1">Success Rate</div>
          </div>
          <div className="flex flex-col items-center p-6 bg-slate-50 rounded-xl border border-slate-100">
            <Clock className="w-8 h-8 text-amber-500 mb-3" />
            <div className="text-3xl font-bold text-slate-900">3.2s</div>
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-1">Avg Duration</div>
          </div>
        </div>
      </section>

      {/* Main Content Area: Recent Runs & Workflows */}
      <section className="px-8 py-16 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Recent Workflows */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Recent Workflows</h2>
            <Link href="/workflows" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">View all &rarr;</Link>
          </div>
          <div className="space-y-4">
            {['Daily ETL Pipeline', 'AI Data Preprocessing', 'Customer Onboarding', 'Weekly Email Blast'].map((name, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                    <Workflow className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{name}</div>
                    <div className="text-xs text-slate-500">v1.0.0 • Published</div>
                  </div>
                </div>
                <Link href="/studio/demo" className="text-sm text-slate-500 hover:text-indigo-600 font-medium">Edit</Link>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Runs */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Recent Runs</h2>
            <Link href="/runs" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">View all &rarr;</Link>
          </div>
          <div className="space-y-4">
            {[
              { wf: 'Daily ETL Pipeline', status: 'COMPLETED', time: '2m ago' },
              { wf: 'AI Data Preprocessing', status: 'RUNNING', time: 'Just now' },
              { wf: 'Customer Onboarding', status: 'FAILED', time: '1h ago' },
              { wf: 'Weekly Email Blast', status: 'COMPLETED', time: '3h ago' },
            ].map((run, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    run.status === 'COMPLETED' ? 'bg-emerald-500' :
                    run.status === 'RUNNING' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <div>
                    <div className="font-semibold text-slate-900">{run.wf}</div>
                    <div className="text-xs text-slate-500">{run.time}</div>
                  </div>
                </div>
                <Link href={`/runs/${i}`} className="text-sm text-slate-500 hover:text-indigo-600 font-medium">Details</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-8 py-20 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Production-Grade Capabilities</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Built from the ground up for high throughput, reliability, and observability.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
              <GitBranch className="w-8 h-8 text-indigo-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Visual Designer</h3>
              <p className="text-slate-400 text-sm">Design complex DAGs with a modern node-based editor. Supports parallel branches, conditional logic, and auto-layout.</p>
            </div>
            
            <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
              <Zap className="w-8 h-8 text-amber-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Distributed Execution</h3>
              <p className="text-slate-400 text-sm">Tasks are dispatched to a fleet of remote workers via Redis message queues for true horizontal scalability.</p>
            </div>
            
            <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Event-Sourced Replay</h3>
              <p className="text-slate-400 text-sm">Every execution generates an immutable event journal, allowing you to perfectly replay failed workflows from terminal states.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-8 bg-slate-950 text-slate-500 text-sm text-center">
        <p>Built with Next.js, NestJS, and Prisma. Distributed Task Platform integration.</p>
      </footer>
    </div>
  );
}
