'use client';

import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { pluginRegistry } from '../../core/plugins/plugin-registry';
import '../../core/plugins/builtin-plugins'; // Ensure registered
import { useBuilderStore } from '../../core/state/builder-store';

export const PluginNode = ({ id, data, isConnectable, selected }: NodeProps) => {
    const pluginId = data.pluginId as string;
    const manifest = pluginRegistry.get(pluginId);
    const validationErrors = useBuilderStore(s => s.validationErrors);
    const nodeErrors = validationErrors.filter(e => e.nodeId === id);
    const hasError = nodeErrors.length > 0;

    // Derive colors from manifest, fallback for unknown plugins
    const bg = manifest?.color.bg || 'bg-gray-100';
    const border = hasError ? 'border-red-500' : (manifest?.color.border || 'border-gray-500');
    const text = manifest?.color.text || 'text-gray-900';
    const colorClass = `${bg} ${border} ${text}`;
    const selectionClass = selected ? 'ring-2 ring-blue-500 ring-offset-2' : (hasError ? 'ring-2 ring-red-300' : '');

    // Derive handles from manifest
    const outputs = manifest?.handles.outputs || ['default'];
    const hasMultipleOutputs = outputs.length > 1;

    return (
        <div className={`px-4 py-2 shadow-md rounded-md border-2 ${colorClass} min-w-[150px] relative ${selectionClass}`}>
            {/* Error Badge */}
            {hasError && (
                <div 
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-sm cursor-help"
                    title={nodeErrors.map(e => e.message).join('\n')}
                >
                    !
                </div>
            )}

            {/* Input Handle */}
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
            
            <div className="font-bold text-sm mb-1">
                {String(data.name || manifest?.name || pluginId.replace('core/', ''))}
            </div>
            
            {/* Output Handles — generated from manifest */}
            {hasMultipleOutputs ? (
                <>
                    {outputs.map((handleId, index) => {
                        const leftPercent = ((index + 1) / (outputs.length + 1)) * 100;
                        return (
                            <React.Fragment key={handleId}>
                                <Handle
                                    type="source"
                                    position={Position.Bottom}
                                    id={handleId}
                                    style={{ left: `${leftPercent}%` }}
                                    isConnectable={isConnectable}
                                />
                                <div
                                    className="text-[10px] absolute pointer-events-none font-medium"
                                    style={{ bottom: '-15px', left: `${leftPercent - 5}%` }}
                                >
                                    {handleId.charAt(0).toUpperCase() + handleId.slice(1)}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </>
            ) : (
                <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
            )}
        </div>
    );
};
