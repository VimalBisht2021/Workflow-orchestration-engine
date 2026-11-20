'use client';

import React from 'react';
import { useBuilderStore, WorkflowCanvas, PropertyPanel, PluginPalette, WorkflowDefinitionAdapter } from '@local/builder';
import Link from 'next/link';
import { ArrowLeft, Save, UploadCloud, Play, Loader2, GitBranch } from 'lucide-react';
import { useRouter } from 'next/navigation';

function WOEToolbar({ workflowId, initialData }: { workflowId?: string, initialData?: any }) {
  const state = useBuilderStore();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [workflowName, setWorkflowName] = React.useState('Draft Workflow');
  const router = useRouter();

  React.useEffect(() => {
    if (initialData) {
      // Very basic manual re-hydration of the store
      useBuilderStore.setState({ nodes: initialData.nodes || [], edges: initialData.edges || [] });
      if (initialData.metadata?.name) {
        setWorkflowName(initialData.metadata.name);
      }
    }
  }, [initialData]);

  const handleSave = async () => {
    setIsSaving(true);
    const currentState = useBuilderStore.getState();
    const data = WorkflowDefinitionAdapter.serialize(
      workflowId === 'new' ? '' : workflowId || '',
      workflowName,
      currentState
    );

    // Build canonical dependency map directly from ALL canvas edges:
    // Any edge source -> target indicates target depends on source.
    const edgeDependencyMap: Record<string, string[]> = {};
    for (const edge of currentState.edges) {
      if (!edgeDependencyMap[edge.target]) edgeDependencyMap[edge.target] = [];
      if (!edgeDependencyMap[edge.target].includes(edge.source)) {
        edgeDependencyMap[edge.target].push(edge.source);
      }
    }

    // Translate builder tasks → API TaskDefinitionDto format
    const apiTasks = (data.tasks || []).map(task => ({
      id: task.id,
      name: task.name || task.pluginId.replace('core/', ''),
      handler: task.pluginId,
      dependencies: Array.from(new Set([
        ...(task.dependencies || []),
        ...(edgeDependencyMap[task.id] || [])
      ])),
      configuration: {
        ...task.config,
        routes: task.routes,
      },
    }));

    try {
      if (workflowId && workflowId !== 'new') {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/workflows/${workflowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tasks: apiTasks,
          }),
        });
        if (res.ok) {
          console.log('Workflow updated successfully');
        } else {
          const err = await res.json().catch(() => ({}));
          console.error('Update failed:', err);
          alert(`Update failed: ${err.message || res.statusText}`);
        }
      } else {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: workflowName || 'Untitled Workflow',
            description: 'Draft workflow from studio',
            owner: 'studio-user',
            tasks: apiTasks,
          }),
        });
        if (res.ok) {
          const w = await res.json();
          router.push(`/studio/${w.id}`);
        } else {
          const err = await res.json().catch(() => ({}));
          console.error('Save failed:', err);
          alert(`Save failed: ${err.message || res.statusText}`);
        }
      }
    } catch (e) {
      console.error(e);
      alert('Failed to connect to the API');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      if (!workflowId || workflowId === 'new') {
        alert('Save the workflow first');
        return;
      }

      // 1. Validate the workflow first
      const validateRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/workflows/${workflowId}/validate`, {
        method: 'POST'
      });
      
      if (!validateRes.ok) {
        alert('Failed to validate workflow');
        return;
      }

      const validation = await validateRes.json();
      if (!validation.valid) {
        alert(`Validation failed:\n${validation.errors?.join('\n')}`);
        return;
      }

      // 2. Publish it
      const publishRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/workflows/${workflowId}/publish`, {
        method: 'POST'
      });

      if (publishRes.ok) {
        alert('Published successfully');
        router.push('/workflows');
      } else {
        const err = await publishRes.json().catch(() => ({}));
        alert(`Failed to publish: ${err.message || 'Unknown error'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to connect to the API');
    } finally {
      setIsPublishing(false);
    }
  };

  const isPublished = initialData?.status === 'PUBLISHED';

  const handleFork = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/workflows/${workflowId}/fork`, {
        method: 'POST'
      });
      if (res.ok) {
        const forked = await res.json();
        alert(`Workflow forked into new version v${forked.version}! Redirecting to editor...`);
        router.push(`/studio/${forked.id}`);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to fork workflow: ${err.message || res.statusText}`);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to connect to the API');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-10 relative">
      <div className="flex items-center space-x-4">
        <Link href="/workflows" className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex flex-col">
          <input 
            type="text"
            value={workflowName}
            disabled={isPublished}
            onChange={(e) => setWorkflowName(e.target.value)}
            className={`text-lg font-semibold bg-transparent border-b border-transparent focus:outline-none transition-colors px-1 py-0.5 ${
              isPublished ? 'text-slate-700 cursor-not-allowed' : 'text-slate-800 hover:border-slate-300 focus:border-indigo-500'
            }`}
            placeholder="Workflow Name"
          />
          <div className="flex items-center space-x-2 px-1 mt-0.5">
            <span className="text-xs text-slate-500">
              {workflowId === 'new' ? 'New Workflow' : `ID: ${workflowId?.split('-')[0]}`}
            </span>
            {initialData?.status && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase ${
                initialData.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
              }`}>
                {initialData.status} • v{initialData.version || 1}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        {isPublished ? (
          <button 
            onClick={handleFork}
            disabled={isSaving}
            className="flex items-center px-4 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GitBranch className="w-4 h-4 mr-2" />}
            Fork New Version
          </button>
        ) : (
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Draft
          </button>
        )}
        <button 
          onClick={handlePublish}
          disabled={isPublishing || !workflowId || workflowId === 'new' || isPublished}
          className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isPublishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
          {isPublished ? 'Published' : 'Publish'}
        </button>
      </div>
    </div>
  );
}

export function StudioView({ workflowId }: { workflowId?: string }) {
  const [initialData, setInitialData] = React.useState<any>(null);

  React.useEffect(() => {
    if (workflowId && workflowId !== 'new' && workflowId !== 'demo') {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/workflows/${workflowId}`)
        .then(res => res.json())
        .then(data => {
          // Translate API tasks (handler/dependencies) back to canvas nodes/edges
          const tasks = data.taskDefinitions || [];
          const nodes = tasks.map((t: any, i: number) => ({
            id: t.id,
            pluginId: t.handler,
            type: 'task',
            position: { x: 200 * (i % 4), y: 150 * Math.floor(i / 4) },
            data: {
              label: t.name,
              name: t.name,
              type: t.handler,
              ...(t.configuration || {}),
            }
          }));

          // Rebuild edges from routes and task dependencies (faithfully restoring parallel forks and joins)
          const edges: any[] = [];
          const existingConn = new Set<string>();

          for (const t of tasks) {
            const routes = t.configuration?.routes;
            if (routes?.conditional) {
              for (const [outcome, targetId] of Object.entries(routes.conditional)) {
                edges.push({
                  id: `e-${t.id}-${targetId}-${outcome}`,
                  source: t.id,
                  target: targetId as string,
                  sourceHandle: outcome,
                  label: outcome,
                });
                existingConn.add(`${t.id}->${targetId}`);
              }
            }
            if (routes?.default && !existingConn.has(`${t.id}->${routes.default}`)) {
              edges.push({
                id: `e-${t.id}-${routes.default}`,
                source: t.id,
                target: routes.default,
              });
              existingConn.add(`${t.id}->${routes.default}`);
            }
            if (Array.isArray(t.dependencies)) {
              for (const depId of t.dependencies) {
                if (!existingConn.has(`${depId}->${t.id}`)) {
                  edges.push({
                    id: `e-${depId}-${t.id}`,
                    source: depId,
                    target: t.id,
                  });
                  existingConn.add(`${depId}->${t.id}`);
                }
              }
            }
          }

          setInitialData({
            metadata: { name: data.name, description: data.description },
            status: data.status,
            version: data.version,
            nodes,
            edges,
            trigger: { type: 'manual' }
          });
        })
        .catch(console.error);
    } else if (workflowId === 'demo') {
      // Provide a demo workflow
      setInitialData({
        metadata: { name: 'Demo ETL Pipeline', description: 'Extract, transform, load' },
        trigger: { type: 'schedule', schedule: '0 0 * * *' },
        nodes: [
          { id: '1', type: 'task', position: { x: 100, y: 100 }, data: { label: 'Extract Data', type: 'http', config: { url: 'https://api.example.com/data' } } },
          { id: '2', type: 'task', position: { x: 400, y: 100 }, data: { label: 'Transform Data', type: 'script', config: { code: 'return data.filter(d => d.active);' } } },
          { id: '3', type: 'task', position: { x: 700, y: 100 }, data: { label: 'Load to DB', type: 'database', config: { table: 'users' } } },
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2' },
          { id: 'e2-3', source: '2', target: '3' },
        ]
      });
    }
  }, [workflowId]);

  return (
    <div className="h-screen flex flex-col w-full bg-slate-50 overflow-hidden">
      <WOEToolbar workflowId={workflowId} initialData={initialData} />
      <div className="flex-1 w-full relative flex flex-row">
        <PluginPalette />
        <div className="flex-1 relative">
          <WorkflowCanvas />
        </div>
        <PropertyPanel />
      </div>
    </div>
  );
}
