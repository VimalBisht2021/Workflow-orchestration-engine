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

// ─── Property Panel ─────────────────────────────────────────────────

export const PropertyPanel = () => {
    const { nodes, selectedNodeId, dispatch } = useBuilderStore();

    if (!selectedNodeId) {
        return (
            <aside className="w-80 bg-white border-l p-4 flex flex-col items-center justify-center text-slate-400">
                <p>Select a node to edit properties</p>
            </aside>
        );
    }

    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return null;

    const manifest = pluginRegistry.get(node.pluginId);

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

    return (
        <aside className="w-80 bg-white border-l p-4 overflow-y-auto z-10 relative">
            <h2 className="font-semibold mb-1 text-slate-800">Properties</h2>
            {manifest && (
                <div className="text-xs text-slate-400 mb-4 font-mono">
                    {manifest.id} v{manifest.pluginVersion}
                </div>
            )}
            
            {/* Node ID */}
            <div className="mb-4">
                <label className="block text-xs font-medium text-slate-500 mb-1">Node ID</label>
                <div className="text-sm font-mono bg-slate-50 p-2 rounded border select-all">{node.id}</div>
            </div>

            {/* Node Name */}
            <div className="mb-4">
                <label className="block text-xs font-medium text-slate-500 mb-1">Node Name</label>
                <input 
                    type="text"
                    value={node.data.name || ''}
                    onChange={handleNameChange}
                    className="w-full border rounded p-2 text-sm text-slate-900 bg-white focus:ring focus:ring-blue-200 outline-none"
                    placeholder={manifest?.name || node.pluginId}
                />
            </div>

            {/* Divider */}
            {manifest && manifest.configSchema.length > 0 && (
                <div className="border-t my-4" />
            )}

            {/* Plugin Config Fields — generated from manifest */}
            {manifest?.configSchema.map(field => {
                const value = node.data[field.key] !== undefined ? node.data[field.key] : field.default;
                const Renderer = fieldRenderers[field.type] || StringField;

                return (
                    <div key={field.key} className="mb-4">
                        <label className="block text-xs font-medium text-slate-500 mb-1">
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

            {/* Fallback for unknown plugins */}
            {!manifest && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700 mb-4">
                    Unknown plugin: <span className="font-mono">{node.pluginId}</span>
                </div>
            )}

            <div className="border-t my-4" />
            <button
                onClick={() => dispatch(new DeleteSelectionCommand([node.id]))}
                className="w-full flex justify-center items-center px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-md text-sm font-medium transition-colors border border-red-200"
            >
                Delete Node
            </button>
        </aside>
    );
};
