'use client';

import React from 'react';
import { useBuilderStore, WorkflowCanvas, PropertyPanel, PluginPalette, WorkflowDefinitionAdapter } from '@local/builder';
import Link from 'next/link';
import { ArrowLeft, Save, UploadCloud, Play, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

function WOEToolbar({ workflowId, initialData }: { workflowId?: string, initialData?: any }) {
  const state = useBuilderStore();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (initialData) {
      // Very basic manual re-hydration of the store
      useBuilderStore.setState({ nodes: initialData.nodes || [], edges: initialData.edges || [] });
    }
  }, [initialData]);

  const handleSave = async () => {
    setIsSaving(true);
    // Use adapter to convert to workflow definition
    const currentState = useBuilderStore.getState();
    const data = WorkflowDefinitionAdapter.serialize(
      workflowId === 'new' ? '' : workflowId || '',
      'Draft Workflow',
      currentState
    );
    try {
      if (workflowId && workflowId !== 'new') {
        // Just pretending to save for now or call API
        console.log('Saved', data);
      } else {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name || 'Untitled Workflow',
            description: 'Draft workflow from studio',
            tasks: data.tasks || [],
            entryTaskId: data.entryTaskId || '',
            metadata: data.metadata || {},
          }),
        });
        if (res.ok) {
          const w = await res.json();
          router.push(`/studio/${w.id}`);
        }
      }
    } catch (e) {
      console.error(e);
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
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/workflows/${workflowId}/publish`, {
        method: 'POST'
      });
      alert('Published successfully');
      router.push('/workflows');
    } catch (e) {
      console.error(e);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-10 relative">
      <div className="flex items-center space-x-4">
        <Link href="/workflows" className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="font-semibold text-slate-800">
          {workflowId === 'new' ? 'Create Workflow' : `Edit Workflow ${workflowId?.split('-')[0]}`}
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Draft
        </button>
        <button 
          onClick={handlePublish}
          disabled={isPublishing || !workflowId || workflowId === 'new'}
          className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isPublishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
          Publish
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
          setInitialData({
            metadata: { name: data.name, description: data.description },
            nodes: data.nodes || [],
            edges: data.edges || [],
            trigger: data.trigger || { type: 'manual' }
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
