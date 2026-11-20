'use client';

import React from 'react';
import { useBuilderStore } from '../../core/state/builder-store';
import { CanvasNode } from '../../core/state/builder-state';
import { UpdatePropertyCommand } from '../../core/commands/node-commands';
import { DeleteSelectionCommand } from '../../core/commands/clipboard-commands';
import { pluginRegistry } from '../../core/plugins/plugin-registry';
import '../../core/plugins/builtin-plugins'; // Ensure registered
import { PluginFieldSchema } from '../../core/plugins/plugin-manifest';

// ─── Field Renderers ────────────────────────────────────────────────

const StringField = ({ field, value, onChange }: FieldProps) => (
    <input
        type="text"
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded p-2 text-sm text-slate-900 bg-white focus:ring focus:ring-blue-200 outline-none"
        placeholder={field.placeholder}
    />
);

const NumberField = ({ field, value, onChange }: FieldProps) => (
    <input
        type="number"
        value={(value as number) ?? field.default ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="w-full border rounded p-2 text-sm text-slate-900 bg-white focus:ring focus:ring-blue-200 outline-none"
        placeholder={field.placeholder}
    />
);

const SelectField = ({ field, value, onChange }: FieldProps) => (
    <select
        value={(value as string) ?? field.default ?? ''}
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
        value={(value as string) || ''}
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
                value={(value as string) || ''}
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
    value: unknown;
    onChange: (value: unknown) => void;
}

const fieldRenderers: Record<PluginFieldSchema['type'], React.FC<FieldProps>> = {
    string: StringField,
    number: NumberField,
    select: SelectField,
    textarea: TextareaField,
    json: JsonField,
    boolean: BooleanField,
};

// ─── Known Output Definitions & Introspection ───────────────────────

const KNOWN_PLUGIN_OUTPUTS: Record<string, { label: string; path: string[]; desc: string }[]> = {
    'core/http': [
        { label: 'body (Response Body JSON / text)', path: ['body'], desc: 'HTTP response body' },
        { label: 'statusCode', path: ['statusCode'], desc: 'HTTP response status (e.g. 200)' },
        { label: 'headers', path: ['headers'], desc: 'Response HTTP headers dictionary' },
    ],
    'core/script': [
        { label: 'result (Returned value)', path: ['result'], desc: 'Returned value from script' },
        { label: 'exitCode', path: ['exitCode'], desc: 'Process exit code (0 for success)' },
        { label: 'stdout', path: ['stdout'], desc: 'Captured console log output' },
    ],
    'core/condition': [
        { label: 'result (Boolean true/false)', path: ['result'], desc: 'Boolean outcome' },
        { label: 'branch (Branch name)', path: ['branch'], desc: 'Taken branch ("true"/"false")' },
    ],
    'core/template': [
        { label: 'rendered', path: ['rendered'], desc: 'Interpolated output text string' },
    ],
    'core/ai': [
        { label: 'content', path: ['content'], desc: 'AI response text or structured output' },
        { label: 'model', path: ['model'], desc: 'Model used for generation' },
    ],
};

export interface NodeOutputOption {
    label: string;
    path: string[];
    description: string;
    badge?: string;
}

/**
 * Introspects output fields for any node based on its plugin type and configuration.
 * For scripts, parses `return { ... }` in the user's code to automatically expose
 * returned keys.
 */
export function getAvailableOutputsForNode(node: CanvasNode | null | undefined): NodeOutputOption[] {
    if (!node) return [];

    if (node.pluginId === 'core/script') {
        const code: string = (node.data?.code as string) || '';
        const options: NodeOutputOption[] = [];

        // Parse object properties from `return { ... }`
        const returnMatch = code.match(/return\s*\{([\s\S]*?)\}/);
        if (returnMatch && returnMatch[1]) {
            const body = returnMatch[1];
            const propRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?::|[,}\n\r]|$)/g;
            let m;
            const seen = new Set<string>();
            while ((m = propRegex.exec(body)) !== null) {
                const prop = m[1].trim();
                if (prop && prop !== 'return' && !seen.has(prop)) {
                    seen.add(prop);
                    options.push({
                        label: `result.${prop}`,
                        path: ['result', prop],
                        description: `Script property: ${prop}`,
                        badge: 'Script Field',
                    });
                }
            }
        }

        // Standard script outputs
        options.push({
            label: 'result (entire return value)',
            path: ['result'],
            description: 'Full returned object or value',
            badge: 'Standard',
        });
        options.push({
            label: 'exitCode',
            path: ['exitCode'],
            description: 'Process exit code (0 for success)',
            badge: 'Standard',
        });
        options.push({
            label: 'stdout',
            path: ['stdout'],
            description: 'Captured console log output',
            badge: 'Standard',
        });

        return options;
    }

    if (node.pluginId === 'core/http') {
        return [
            { label: 'body (Response Body JSON / text)', path: ['body'], description: 'Parsed response body', badge: 'HTTP' },
            { label: 'statusCode (e.g. 200, 404)', path: ['statusCode'], description: 'HTTP status code', badge: 'HTTP' },
            { label: 'headers (Response Headers)', path: ['headers'], description: 'HTTP headers dictionary', badge: 'HTTP' },
        ];
    }

    if (node.pluginId === 'core/condition') {
        return [
            { label: 'result (Boolean true/false)', path: ['result'], description: 'Evaluation outcome', badge: 'Logic' },
            { label: 'branch ("true" / "false")', path: ['branch'], description: 'Branch taken', badge: 'Logic' },
        ];
    }

    if (node.pluginId === 'core/template') {
        return [
            { label: 'rendered (Interpolated text)', path: ['rendered'], description: 'Rendered template string', badge: 'Template' },
        ];
    }

    if (node.pluginId === 'core/ai') {
        return [
            { label: 'content (Generated text / JSON)', path: ['content'], description: 'AI generated response', badge: 'AI' },
            { label: 'model', path: ['model'], description: 'Model used', badge: 'AI' },
        ];
    }

    const known = KNOWN_PLUGIN_OUTPUTS[node.pluginId];
    if (known && known.length > 0) {
        return known.map(k => ({ ...k, description: k.desc, badge: 'Default' }));
    }

    return [
        { label: 'output (Default output)', path: ['output'], description: 'Task output payload', badge: 'Generic' },
    ];
}

// ─── Input Mapping Section Component ────────────────────────────────

interface MappingRow {
    id: string; // Stable React key — never changes when editing variable name
    targetKey: string;
    sourceNodeId: string;
    path: string[];
}

interface InputMappingSectionProps {
    node?: CanvasNode;
    ancestorNodes: CanvasNode[];
    inputMapping: Record<string, { sourceNodeId: string; path: string[] }>;
    onUpdateMapping: (updated: Record<string, { sourceNodeId: string; path: string[] }>) => void;
}

const InputMappingSection: React.FC<InputMappingSectionProps> = ({
    ancestorNodes,
    inputMapping = {},
    onUpdateMapping,
}) => {
    // Maintain stable rows so typing in variable names does not unmount input elements or drop focus
    const [rows, setRows] = React.useState<MappingRow[]>(() => {
        return Object.entries(inputMapping).map(([key, binding], i) => ({
            id: `row_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
            targetKey: key,
            sourceNodeId: binding?.sourceNodeId || (ancestorNodes[0]?.id ?? ''),
            path: binding?.path || [],
        }));
    });

    const [customPaths, setCustomPaths] = React.useState<Record<string, string>>({});
    const lastEmittedJsonRef = React.useRef<string>(JSON.stringify(inputMapping));

    // Synchronize external updates (such as undo/redo) without interfering with local keystrokes
    React.useEffect(() => {
        const currentJson = JSON.stringify(inputMapping);
        if (currentJson !== lastEmittedJsonRef.current) {
            lastEmittedJsonRef.current = currentJson;
            setRows(Object.entries(inputMapping).map(([key, binding], i) => ({
                id: `row_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
                targetKey: key,
                sourceNodeId: binding?.sourceNodeId || (ancestorNodes[0]?.id ?? ''),
                path: binding?.path || [],
            })));
        }
    }, [inputMapping, ancestorNodes]);

    const syncRowsToStore = (currentRows: MappingRow[]) => {
        const nextMapping: Record<string, { sourceNodeId: string; path: string[] }> = {};
        for (const r of currentRows) {
            const trimmed = r.targetKey.trim();
            if (trimmed) {
                nextMapping[trimmed] = {
                    sourceNodeId: r.sourceNodeId,
                    path: r.path,
                };
            }
        }
        lastEmittedJsonRef.current = JSON.stringify(nextMapping);
        onUpdateMapping(nextMapping);
    };

    const handleAddMapping = () => {
        if (ancestorNodes.length === 0) return;
        const defaultSource = ancestorNodes[0];
        const available = getAvailableOutputsForNode(defaultSource);
        const defaultOutput = available[0] || { path: ['result'] };

        // Auto-generate a clean variable name based on the output field
        const leaf = defaultOutput.path[defaultOutput.path.length - 1] || 'val';
        let suggestedKey = leaf === 'result' ? 'input_data' : leaf;
        const existingKeys = new Set(rows.map(r => r.targetKey.trim()));
        let counter = 1;
        while (existingKeys.has(suggestedKey)) {
            counter++;
            suggestedKey = `${leaf}_${counter}`;
        }

        const newRow: MappingRow = {
            id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            targetKey: suggestedKey,
            sourceNodeId: defaultSource.id,
            path: defaultOutput.path,
        };

        const nextRows = [...rows, newRow];
        setRows(nextRows);
        syncRowsToStore(nextRows);
    };

    const handleRemoveMapping = (rowId: string) => {
        const nextRows = rows.filter(r => r.id !== rowId);
        setRows(nextRows);
        syncRowsToStore(nextRows);
        setCustomPaths(prev => {
            const next = { ...prev };
            delete next[rowId];
            return next;
        });
    };

    const handleKeyChange = (rowId: string, newKey: string) => {
        const nextRows = rows.map(r => r.id === rowId ? { ...r, targetKey: newKey } : r);
        setRows(nextRows);
        syncRowsToStore(nextRows);
    };

    const handleSourceChange = (rowId: string, newSourceId: string) => {
        const targetSource = ancestorNodes.find(a => a.id === newSourceId);
        const available = getAvailableOutputsForNode(targetSource);
        const defaultOutput = available[0] || { path: ['result'] };

        const nextRows = rows.map(r => {
            if (r.id !== rowId) return r;
            return {
                ...r,
                sourceNodeId: newSourceId,
                path: defaultOutput.path,
            };
        });
        setRows(nextRows);
        syncRowsToStore(nextRows);
    };

    const handlePathPresetChange = (rowId: string, pathValue: string) => {
        if (pathValue === '__custom__') {
            const row = rows.find(r => r.id === rowId);
            const currentStr = row ? row.path.join('.') : 'data';
            setCustomPaths(prev => ({ ...prev, [rowId]: currentStr }));
            return;
        }

        const segments = pathValue.split('.').filter(Boolean);
        const nextRows = rows.map(r => {
            if (r.id !== rowId) return r;
            const leaf = segments[segments.length - 1];
            let nextKey = r.targetKey;
            if (!nextKey.trim() || nextKey.startsWith('input_') || nextKey === 'input_data') {
                nextKey = leaf;
            }
            return {
                ...r,
                targetKey: nextKey,
                path: segments,
            };
        });
        setRows(nextRows);
        syncRowsToStore(nextRows);
    };

    const handleQuickSelect = (rowId: string, compositeValue: string) => {
        if (!compositeValue) return;
        const [sourceId, pathStr] = compositeValue.split('::');
        if (!sourceId || !pathStr) return;

        const segments = pathStr.split('.').filter(Boolean);
        const leaf = segments[segments.length - 1];

        const nextRows = rows.map(r => {
            if (r.id !== rowId) return r;
            let nextKey = r.targetKey;
            if (!nextKey.trim() || nextKey.startsWith('input_') || nextKey === 'input_data') {
                nextKey = leaf;
            }
            return {
                ...r,
                targetKey: nextKey,
                sourceNodeId: sourceId,
                path: segments,
            };
        });
        setRows(nextRows);
        syncRowsToStore(nextRows);
    };

    const handleCustomPathChange = (rowId: string, rawText: string) => {
        setCustomPaths(prev => ({ ...prev, [rowId]: rawText }));
        const segments = rawText.split('.').map(s => s.trim()).filter(Boolean);
        const nextRows = rows.map(r => r.id === rowId ? { ...r, path: segments } : r);
        setRows(nextRows);
        syncRowsToStore(nextRows);
    };

    // Validation checks across current rows
    const keyCounts: Record<string, number> = {};
    for (const r of rows) {
        const k = r.targetKey.trim();
        if (k) keyCounts[k] = (keyCounts[k] || 0) + 1;
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
            ) : rows.length === 0 ? (
                <div className="text-center py-4 border border-dashed border-slate-300 rounded text-xs text-slate-500">
                    No inputs mapped yet. Click <strong className="text-blue-600 cursor-pointer" onClick={handleAddMapping}>+ Add Mapping</strong> to bind data.
                </div>
            ) : (
                <div className="space-y-3">
                    {rows.map((row) => {
                        const targetKey = row.targetKey;
                        const trimmedKey = targetKey.trim();
                        const isDuplicateKey = trimmedKey ? (keyCounts[trimmedKey] || 0) > 1 : false;
                        const isEmptyKey = !trimmedKey;
                        const sourceNode = ancestorNodes.find(a => a.id === row.sourceNodeId);
                        const isDisconnected = !sourceNode;
                        const availableOutputs = sourceNode ? getAvailableOutputsForNode(sourceNode) : [];
                        const currentPathStr = (row.path || []).join('.');
                        const isPreset = availableOutputs.some(o => o.path.join('.') === currentPathStr);
                        const isCustom = customPaths[row.id] !== undefined || (!isPreset && currentPathStr !== '');

                        // Check if current path belongs to a different ancestor node (to offer 1-click switch)
                        let suggestedNode: CanvasNode | null = null;
                        if (sourceNode && !isPreset && currentPathStr) {
                            for (const anc of ancestorNodes) {
                                if (anc.id === sourceNode.id) continue;
                                const ancOutputs = getAvailableOutputsForNode(anc);
                                if (ancOutputs.some(o => o.path.join('.') === currentPathStr || o.path[o.path.length - 1] === row.path[row.path.length - 1])) {
                                    suggestedNode = anc;
                                    break;
                                }
                            }
                        }

                        return (
                            <div key={row.id} className="p-2.5 bg-white border border-slate-200 rounded shadow-xs text-xs space-y-2">
                                {/* Variable Name & Remove button */}
                                <div className="flex items-center gap-1.5">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Variable Name</label>
                                        <input
                                            type="text"
                                            value={targetKey}
                                            onChange={(e) => handleKeyChange(row.id, e.target.value)}
                                            placeholder="e.g. customerId"
                                            className={`w-full border rounded px-2 py-1 text-xs font-mono text-slate-900 bg-white outline-none ${
                                                isDuplicateKey || isEmptyKey ? 'border-red-400 focus:ring-1 focus:ring-red-400' : 'border-slate-300 focus:border-blue-400'
                                            }`}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveMapping(row.id)}
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

                                {/* Quick-Select Across Connected Steps */}
                                {ancestorNodes.length > 1 && (
                                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                                        <label className="block text-[9px] font-medium text-slate-500 mb-0.5">
                                            Quick Pick (Step + Output):
                                        </label>
                                        <select
                                            value=""
                                            onChange={(e) => handleQuickSelect(row.id, e.target.value)}
                                            className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-700 bg-white outline-none"
                                        >
                                            <option value="">-- Select from any upstream step --</option>
                                            {ancestorNodes.map(anc => {
                                                const outputs = getAvailableOutputsForNode(anc);
                                                return (
                                                    <optgroup key={anc.id} label={`${anc.data.name || anc.id} (${anc.pluginId})`}>
                                                        {outputs.map(out => (
                                                            <option key={`${anc.id}::${out.path.join('.')}`} value={`${anc.id}::${out.path.join('.')}`}>
                                                                {anc.data.name || 'Step'} → {out.label}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                );
                                            })}
                                        </select>
                                    </div>
                                )}

                                {/* Source Step Selector */}
                                <div>
                                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Source Step</label>
                                    <select
                                        value={row.sourceNodeId || ''}
                                        onChange={(e) => handleSourceChange(row.id, e.target.value)}
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

                                {/* Output Field Selector */}
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
                                            onChange={(e) => handlePathPresetChange(row.id, e.target.value)}
                                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 bg-white outline-none"
                                        >
                                            {availableOutputs.map(o => (
                                                <option key={o.path.join('.')} value={o.path.join('.')}>
                                                    {o.label} ({o.description})
                                                </option>
                                            ))}
                                            <option value="__custom__">Custom path (e.g. body.user.id)...</option>
                                        </select>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex gap-1">
                                                <input
                                                    type="text"
                                                    value={customPaths[row.id] ?? currentPathStr}
                                                    onChange={(e) => handleCustomPathChange(row.id, e.target.value)}
                                                    placeholder="e.g. body.user.id or result.items.0"
                                                    className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-900 bg-white outline-none focus:border-blue-400"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const next = { ...customPaths };
                                                        delete next[row.id];
                                                        setCustomPaths(next);
                                                        const firstKnown = availableOutputs[0]?.path?.join('.') || 'result';
                                                        handlePathPresetChange(row.id, firstKnown);
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

                                    {/* Mismatch Alert & 1-Click Fix Button */}
                                    {suggestedNode && (
                                        <div className="text-[10px] bg-amber-50 text-amber-900 border border-amber-300 rounded p-2 mt-1.5 space-y-1">
                                            <div className="font-semibold flex items-center gap-1">
                                                <span>💡 Wrong Step Selected:</span>
                                            </div>
                                            <div>
                                                Field <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">{currentPathStr}</code> belongs to <strong>{suggestedNode.data.name || suggestedNode.id}</strong> ({suggestedNode.pluginId}), but you currently have <strong>{sourceNode?.data.name || 'another step'}</strong> selected.
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleSourceChange(row.id, (suggestedNode as CanvasNode).id)}
                                                className="mt-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-medium shadow-xs"
                                            >
                                                Switch Source to &ldquo;{suggestedNode.data.name || 'correct step'}&rdquo;
                                            </button>
                                        </div>
                                    )}

                                    {sourceNode?.pluginId === 'core/http' && currentPathStr.startsWith('result.') && !suggestedNode && (
                                        <div className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200 mt-1 leading-snug">
                                            ⚠️ <strong>Mismatched Step:</strong> &ldquo;{sourceNode.data.name || 'HTTP Step'}&rdquo; is an HTTP request producing <code>statusCode</code>, <code>body</code>, and <code>headers</code>. If you need <code>result.*</code>, change <strong>Source Step</strong> to a script node.
                                        </div>
                                    )}
                                </div>

                                {/* Preview Badge */}
                                <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-600">
                                    <span className="text-blue-600 font-semibold">{trimmedKey || '—'}</span>
                                    <span>←</span>
                                    <span className="truncate max-w-[170px] text-slate-700 font-sans" title={`${sourceNode?.data.name || sourceNode?.pluginId} / ${(row.path || []).join(' / ')}`}>
                                        {sourceNode?.data.name || sourceNode?.pluginId || 'Step'} / <span className="font-mono text-indigo-600">{(row.path || []).join(' / ')}</span>
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
    const getAncestorNodes = (targetId: string): CanvasNode[] => {
        const ancestors: CanvasNode[] = [];
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

    const handleChange = (key: string, value: unknown) => {
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
                key={node.id}
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
