'use client';

import React from 'react';
import { useBuilderStore } from '../../core/state/builder-store';
import { UpdatePropertyCommand } from '../../core/commands/node-commands';
import { DeleteSelectionCommand } from '../../core/commands/clipboard-commands';
import { pluginRegistry } from '../../core/plugins/plugin-registry';
import '../../core/plugins/builtin-plugins'; // Ensure registered
import { PluginFieldSchema } from '../../core/plugins/plugin-manifest';

// ─── Field Renderers ────────────────────────────────────────────────

const StringField = ({ field, value, onChange }: FieldProps) => (
    <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded p-2 text-sm text-slate-900 bg-white focus:ring focus:ring-blue-200 outline-none"
        placeholder={field.placeholder}
    />
);

const NumberField = ({ field, value, onChange }: FieldProps) => (
    <input
        type="number"
        value={value ?? field.default ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="w-full border rounded p-2 text-sm text-slate-900 bg-white focus:ring focus:ring-blue-200 outline-none"
        placeholder={field.placeholder}
    />
);

const SelectField = ({ field, value, onChange }: FieldProps) => (
    <select
        value={value ?? field.default ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded p-2 text-sm text-slate-900 focus:ring focus:ring-blue-200 outline-none bg-white"
    >
        {field.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
        ))}
    </select>
);

const TextareaField = ({ field, value, onChange }: FieldProps) => (
    <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded p-2 text-sm text-slate-900 bg-white focus:ring focus:ring-blue-200 outline-none min-h-[80px] font-mono"
        placeholder={field.placeholder}
        rows={4}
    />
);

const JsonField = ({ field, value, onChange }: FieldProps) => {
    const [error, setError] = React.useState<string | null>(null);

    const handleChange = (raw: string) => {
        onChange(raw);
        try {
            if (raw.trim()) JSON.parse(raw);
            setError(null);
        } catch {
            setError('Invalid JSON');
        }
    };

    return (
        <div>
            <textarea
                value={value || ''}
                onChange={(e) => handleChange(e.target.value)}
                className={`w-full border rounded p-2 text-sm text-slate-900 bg-white focus:ring outline-none min-h-[60px] font-mono ${
                    error ? 'border-red-400 focus:ring-red-200' : 'focus:ring-blue-200'
                }`}
                placeholder={field.placeholder}
                rows={3}
            />
            {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
        </div>
    );
};

const BooleanField = ({ value, onChange }: FieldProps) => (
    <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
    />
);

// ─── Field Props ────────────────────────────────────────────────────

interface FieldProps {
    field: PluginFieldSchema;
    value: any;
    onChange: (value: any) => void;
}

const fieldRenderers: Record<PluginFieldSchema['type'], React.FC<FieldProps>> = {
    string: StringField,
    number: NumberField,
    select: SelectField,
    textarea: TextareaField,
    json: JsonField,
    boolean: BooleanField,
};

// ─── Known Output Definitions for Builtin Plugins ───────────────────

const KNOWN_PLUGIN_OUTPUTS: Record<string, { label: string; path: string[]; desc: string }[]> = {
    'core/http': [
        { label: 'Response Body (parsed JSON / text)', path: ['body'], desc: 'HTTP response body' },
        { label: 'Status Code', path: ['statusCode'], desc: 'HTTP response status (e.g. 200)' },
        { label: 'Headers', path: ['headers'], desc: 'Response HTTP headers dictionary' },
    ],
    'core/script': [
        { label: 'Returned Result', path: ['result'], desc: 'Returned value from script' },
        { label: 'Exit Code', path: ['exitCode'], desc: 'Process exit code (0 for success)' },
        { label: 'Logs / stdout', path: ['stdout'], desc: 'Captured console log output' },
    ],
    'core/condition': [
        { label: 'Condition Result', path: ['result'], desc: 'Boolean outcome (true/false)' },
        { label: 'Branch Name', path: ['branch'], desc: 'Taken branch string ("true"/"false")' },
    ],
    'core/template': [
        { label: 'Rendered Output', path: ['rendered'], desc: 'Interpolated output text string' },
    ],
    'core/ai': [
        { label: 'Generated Text', path: ['content'], desc: 'AI response text or structured output' },
        { label: 'Model', path: ['model'], desc: 'Model used for generation' },
    ],
};

// ─── Input Mapping Section Component ────────────────────────────────

interface InputMappingSectionProps {
    node: any;
    ancestorNodes: any[];
    inputMapping: Record<string, { sourceNodeId: string; path: string[] }>;
    onUpdateMapping: (updated: Record<string, { sourceNodeId: string; path: string[] }>) => void;
}

const InputMappingSection: React.FC<InputMappingSectionProps> = ({
    node,
    ancestorNodes,
    inputMapping = {},
    onUpdateMapping,
}) => {
    const [customPaths, setCustomPaths] = React.useState<Record<string, string>>({});

    const entries = Object.entries(inputMapping);

    const handleAddMapping = () => {
        if (ancestorNodes.length === 0) return;
        const defaultSource = ancestorNodes[0];
        const known = KNOWN_PLUGIN_OUTPUTS[defaultSource.pluginId];
        const defaultPath = known && known.length > 0 ? known[0].path : ['result'];

        // Auto-generate a clean variable name
        let index = 1;
        while (inputMapping[`input_${index}`]) index++;
        const newKey = `input_${index}`;

        onUpdateMapping({
            ...inputMapping,
            [newKey]: {
                sourceNodeId: defaultSource.id,
                path: defaultPath,
            },
        });
    };

    const handleRemoveMapping = (key: string) => {
        const next = { ...inputMapping };
        delete next[key];
        onUpdateMapping(next);
    };

    const handleKeyChange = (oldKey: string, newKey: string) => {
        if (oldKey === newKey) return;
        const next: Record<string, any> = {};
        for (const [k, v] of Object.entries(inputMapping)) {
            if (k === oldKey) {
                next[newKey] = v;
            } else {
                next[k] = v;
            }
        }
        onUpdateMapping(next);
    };

    const handleSourceChange = (key: string, newSourceId: string) => {
        const targetSource = ancestorNodes.find(a => a.id === newSourceId);
        const known = targetSource ? KNOWN_PLUGIN_OUTPUTS[targetSource.pluginId] : null;
        const defaultPath = known && known.length > 0 ? known[0].path : ['body'];

        onUpdateMapping({
            ...inputMapping,
            [key]: {
                sourceNodeId: newSourceId,
                path: defaultPath,
            },
        });
    };

    const handlePathPresetChange = (key: string, pathValue: string) => {
        if (pathValue === '__custom__') {
            const currentBinding = inputMapping[key];
            const currentStr = currentBinding?.path ? currentBinding.path.join('.') : '';
            setCustomPaths(prev => ({ ...prev, [key]: currentStr || 'body.data' }));
            return;
        }

        const segments = pathValue.split('.').filter(Boolean);
        onUpdateMapping({
            ...inputMapping,
            [key]: {
                ...inputMapping[key],
                path: segments,
            },
        });
    };

    const handleCustomPathChange = (key: string, rawText: string) => {
        setCustomPaths(prev => ({ ...prev, [key]: rawText }));
        const segments = rawText.split('.').map(s => s.trim()).filter(Boolean);
        onUpdateMapping({
            ...inputMapping,
            [key]: {
                ...inputMapping[key],
                path: segments,
            },
        });
    };

    // Validation
    const keysCount: Record<string, number> = {};
    for (const [k] of entries) {
        keysCount[k] = (keysCount[k] || 0) + 1;
    }

    return (
        <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📥</span> Input Mapping
                </span>
                {ancestorNodes.length > 0 && (
                    <button
                        type="button"
                        onClick={handleAddMapping}
                        className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-sm transition-colors"
                    >
                        + Add Mapping
                    </button>
                )}
            </div>

            <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                Bind outputs from upstream steps to named variables for this task. Inside scripts, access them directly as <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px] text-slate-800">input.varName</code>.
            </p>

            {ancestorNodes.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
                    <span className="text-sm">ℹ️</span>
                    <div>
                        <div className="font-medium">No Upstream Steps Connected</div>
                        <div className="text-[11px] text-amber-700 mt-0.5">
                            Connect an upstream step on the canvas to this node to map its output data.
                        </div>
                    </div>
                </div>
            ) : entries.length === 0 ? (
                <div className="text-center py-4 border border-dashed border-slate-300 rounded text-xs text-slate-500">
                    No inputs mapped yet. Click <strong className="text-blue-600 cursor-pointer" onClick={handleAddMapping}>+ Add Mapping</strong> to bind data.
                </div>
            ) : (
                <div className="space-y-3">
                    {entries.map(([targetKey, binding]) => {
                        const isDuplicateKey = keysCount[targetKey] > 1;
                        const isEmptyKey = !targetKey.trim();
                        const sourceNode = ancestorNodes.find(a => a.id === binding?.sourceNodeId);
                        const isDisconnected = !sourceNode;
                        const knownOutputs = sourceNode ? KNOWN_PLUGIN_OUTPUTS[sourceNode.pluginId] || [] : [];
                        const currentPathStr = (binding?.path || []).join('.');
                        const isPreset = knownOutputs.some(o => o.path.join('.') === currentPathStr);
                        const isCustom = customPaths[targetKey] !== undefined || (!isPreset && currentPathStr !== '');

                        return (
                            <div key={targetKey} className="p-2.5 bg-white border border-slate-200 rounded shadow-xs text-xs space-y-2">
                                <div className="flex items-center gap-1.5">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Variable Name</label>
                                        <input
                                            type="text"
                                            value={targetKey}
                                            onChange={(e) => handleKeyChange(targetKey, e.target.value)}
                                            placeholder="e.g. customerId"
                                            className={`w-full border rounded px-2 py-1 text-xs font-mono text-slate-900 bg-white outline-none ${
                                                isDuplicateKey || isEmptyKey ? 'border-red-400 focus:ring-1 focus:ring-red-400' : 'border-slate-300 focus:border-blue-400'
                                            }`}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveMapping(targetKey)}
                                        title="Remove mapping"
                                        className="mt-3.5 p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {isDuplicateKey && (
                                    <div className="text-[10px] text-red-600">⚠️ Duplicate variable name</div>
                                )}
                                {isEmptyKey && (
                                    <div className="text-[10px] text-red-600">⚠️ Variable name is required</div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Source Step</label>
                                    <select
                                        value={binding?.sourceNodeId || ''}
                                        onChange={(e) => handleSourceChange(targetKey, e.target.value)}
                                        className={`w-full border rounded px-2 py-1 text-xs text-slate-800 bg-white outline-none ${
                                            isDisconnected ? 'border-red-400 bg-red-50' : 'border-slate-300'
                                        }`}
                                    >
                                        {ancestorNodes.map(a => (
                                            <option key={a.id} value={a.id}>
                                                {a.data.name || a.pluginId.replace('core/', '')} ({a.pluginId})
                                            </option>
                                        ))}
                                    </select>
                                    {isDisconnected && (
                                        <div className="text-[10px] text-red-600 mt-0.5">⚠️ Source step is disconnected from dependencies</div>
                                    )}
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <label className="block text-[10px] font-medium text-slate-500">Output Field / Path</label>
                                        {isCustom && (
                                            <span className="text-[9px] text-slate-400 font-mono">Custom property path</span>
                                        )}
                                    </div>

                                    {!isCustom ? (
                                        <select
                                            value={currentPathStr}
                                            onChange={(e) => handlePathPresetChange(targetKey, e.target.value)}
                                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 bg-white outline-none"
                                        >
                                            {knownOutputs.map(o => (
                                                <option key={o.path.join('.')} value={o.path.join('.')}>
                                                    {o.label} ({o.path.join('.')})
                                                </option>
                                            ))}
                                            <option value="__custom__">Custom path (e.g. body.user.id)...</option>
                                        </select>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex gap-1">
                                                <input
                                                    type="text"
                                                    value={customPaths[targetKey] ?? currentPathStr}
                                                    onChange={(e) => handleCustomPathChange(targetKey, e.target.value)}
                                                    placeholder="e.g. body.user.id or items.0.name"
                                                    className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-900 bg-white outline-none focus:border-blue-400"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const next = { ...customPaths };
                                                        delete next[targetKey];
                                                        setCustomPaths(next);
                                                        const firstKnown = knownOutputs[0]?.path?.join('.') || 'body';
                                                        handlePathPresetChange(targetKey, firstKnown);
                                                    }}
                                                    className="px-1.5 py-1 text-[10px] text-slate-500 hover:text-slate-700 bg-slate-100 rounded border border-slate-200"
                                                    title="Switch back to presets"
                                                >
                                                    Presets
                                                </button>
                                            </div>
                                            <div className="text-[9px] text-slate-400">
                                                Use dot notation for nested properties & array indices.
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Preview Badge */}
                                <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-600">
                                    <span className="text-blue-600 font-semibold">{targetKey}</span>
                                    <span>←</span>
                                    <span className="truncate max-w-[170px] text-slate-700 font-sans" title={`${sourceNode?.data.name || sourceNode?.pluginId} / ${(binding?.path || []).join(' / ')}`}>
                                        {sourceNode?.data.name || sourceNode?.pluginId || 'Step'} / <span className="font-mono text-indigo-600">{(binding?.path || []).join(' / ')}</span>
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Property Panel ─────────────────────────────────────────────────

export const PropertyPanel = () => {
    const { nodes, edges, selectedNodeId, validationErrors, dispatch } = useBuilderStore();
    const [showTechDetails, setShowTechDetails] = React.useState(false);

    if (!selectedNodeId) {
        return (
            <aside className="w-80 h-full min-h-0 bg-white border-l p-4 flex flex-col items-center justify-center text-slate-400">
                <p>Select a node to edit properties</p>
            </aside>
        );
    }

    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return null;

    const manifest = pluginRegistry.get(node.pluginId);
    const nodeErrors = (validationErrors || []).filter(e => e.nodeId === node.id);

    // Compute all upstream ancestor nodes in reverse topological reachability order
    const getAncestorNodes = (targetId: string): any[] => {
        const ancestors: any[] = [];
        const visited = new Set<string>();
        const queue: string[] = [];

        edges.filter(e => e.target === targetId).forEach(e => {
            if (!visited.has(e.source)) {
                visited.add(e.source);
                queue.push(e.source);
            }
        });

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const anc = nodes.find(n => n.id === currentId);
            if (anc) {
                ancestors.push(anc);
                edges.filter(e => e.target === currentId).forEach(e => {
                    if (!visited.has(e.source)) {
                        visited.add(e.source);
                        queue.push(e.source);
                    }
                });
            }
        }
        return ancestors;
    };

    const ancestorNodes = getAncestorNodes(node.id);

    const handleChange = (key: string, value: any) => {
        dispatch(new UpdatePropertyCommand(
            node.id, 
            { [key]: value }, 
            { [key]: node.data[key] }
        ));
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(new UpdatePropertyCommand(
            node.id, 
            { name: e.target.value }, 
            { name: node.data.name }
        ));
    };

    const handleInputMappingUpdate = (updated: Record<string, { sourceNodeId: string; path: string[] }>) => {
        dispatch(new UpdatePropertyCommand(
            node.id,
            { inputMapping: updated },
            { inputMapping: node.data.inputMapping }
        ));
    };

    return (
        <aside className="w-80 h-full min-h-0 bg-white border-l p-4 overflow-y-auto z-10 relative">
            <h2 className="font-semibold mb-1 text-slate-800">Step Properties</h2>
            {manifest && (
                <div className="text-xs text-slate-400 mb-3 font-medium">
                    {manifest.name} ({manifest.id})
                </div>
            )}

            {/* Validation Errors Box */}
            {nodeErrors.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                    <div className="font-semibold mb-1 flex items-center">
                        <span>⚠️ Validation Notice</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1">
                        {nodeErrors.map((err, i) => (
                            <li key={i}>{err.message}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Step Display Name */}
            <div className="mb-4">
                <label className="block text-xs font-medium text-slate-600 mb-1">Step Name</label>
                <input 
                    type="text"
                    value={node.data.name || ''}
                    onChange={handleNameChange}
                    className="w-full border border-slate-300 rounded p-2 text-sm text-slate-900 bg-white focus:ring focus:ring-blue-100 focus:border-blue-500 outline-none font-medium"
                    placeholder={manifest?.name || node.pluginId}
                />
            </div>

            {/* Input Mapping Section */}
            <InputMappingSection
                node={node}
                ancestorNodes={ancestorNodes}
                inputMapping={node.data.inputMapping || {}}
                onUpdateMapping={handleInputMappingUpdate}
            />

            {/* Plugin Config Fields — generated from manifest */}
            {manifest?.configSchema && manifest.configSchema.length > 0 && (
                <div className="space-y-4 pt-1 border-t border-slate-200">
                    <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mt-3">
                        Task Configuration
                    </h3>
                    {manifest.configSchema.map(field => {
                        const value = node.data[field.key] !== undefined ? node.data[field.key] : field.default;
                        const Renderer = fieldRenderers[field.type] || StringField;

                        return (
                            <div key={field.key} className="mb-3">
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    {field.title}
                                    {field.required && <span className="text-red-400 ml-1">*</span>}
                                </label>
                                <Renderer
                                    field={field}
                                    value={value}
                                    onChange={(v) => handleChange(field.key, v)}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Fallback for unknown plugins */}
            {!manifest && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700 mb-4">
                    Unknown plugin: <span className="font-mono">{node.pluginId}</span>
                </div>
            )}

            {/* Developer Details (Collapsed by default so IDs are hidden from non-technical users) */}
            <div className="border-t my-4 pt-2">
                <button
                    type="button"
                    onClick={() => setShowTechDetails(!showTechDetails)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center justify-between w-full font-mono"
                >
                    <span>Developer Details</span>
                    <span>{showTechDetails ? '▲' : '▼'}</span>
                </button>
                {showTechDetails && (
                    <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono space-y-1 select-all">
                        <div><strong className="text-slate-500">ID:</strong> {node.id}</div>
                        <div><strong className="text-slate-500">Plugin:</strong> {node.pluginId}</div>
                    </div>
                )}
            </div>

            <button
                onClick={() => dispatch(new DeleteSelectionCommand([node.id]))}
                className="w-full flex justify-center items-center px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-md text-sm font-medium transition-colors border border-red-200"
            >
                Delete Step
            </button>
        </aside>
    );
};
