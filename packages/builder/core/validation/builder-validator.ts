import { BuilderState } from '../state/builder-state';

export interface ValidationError {
    nodeId: string;
    message: string;
}

export class BuilderValidator {
    static validate(state: BuilderState): ValidationError[] {
        const errors: ValidationError[] = [];

        // 1. Condition Routes Validation
        for (const node of state.nodes) {
            if (node.pluginId === 'core/condition') {
                const outEdges = state.edges.filter(e => e.source === node.id);
                const hasTrue = outEdges.some(e => e.sourceHandle === 'true' || e.label === 'true');
                const hasFalse = outEdges.some(e => e.sourceHandle === 'false' || e.label === 'false');

                if (!hasTrue || !hasFalse) {
                    errors.push({
                        nodeId: node.id,
                        message: 'Condition node must have both "True" and "False" branches connected.'
                    });
                }
            }
        }

        // 2. Disconnected Nodes Check
        if (state.nodes.length > 1) {
            for (const node of state.nodes) {
                const hasConnections = state.edges.some(e => e.source === node.id || e.target === node.id);
                if (!hasConnections) {
                    errors.push({
                        nodeId: node.id,
                        message: 'Node is disconnected from the workflow graph.'
                    });
                }
            }
        }

        // 3. Cycle Detection (DFS)
        const adj = new Map<string, string[]>();
        for (const node of state.nodes) {
            adj.set(node.id, []);
        }
        for (const edge of state.edges) {
            adj.get(edge.source)?.push(edge.target);
        }

        const visited = new Set<string>();
        const recStack = new Set<string>();
        const cyclicNodes = new Set<string>();

        function checkCycle(nodeId: string): boolean {
            visited.add(nodeId);
            recStack.add(nodeId);

            for (const neighbor of adj.get(nodeId) || []) {
                if (!visited.has(neighbor)) {
                    if (checkCycle(neighbor)) {
                        cyclicNodes.add(nodeId);
                        return true;
                    }
                } else if (recStack.has(neighbor)) {
                    cyclicNodes.add(nodeId);
                    cyclicNodes.add(neighbor);
                    return true;
                }
            }

            recStack.delete(nodeId);
            return false;
        }

        for (const node of state.nodes) {
            if (!visited.has(node.id)) {
                checkCycle(node.id);
            }
        }

        for (const cyclicId of cyclicNodes) {
            errors.push({
                nodeId: cyclicId,
                message: 'Cycle detected: This node is part of a circular dependency loop.'
            });
        }

        // 4. Required Fields Validation
        for (const node of state.nodes) {
            if (node.pluginId === 'core/http' && !node.data.url) {
                errors.push({ nodeId: node.id, message: 'HTTP Request requires a target URL.' });
            }
            if (node.pluginId === 'core/script' && !node.data.code) {
                errors.push({ nodeId: node.id, message: 'Script node requires code to execute.' });
            }
            if (node.pluginId === 'core/condition' && !node.data.expression) {
                errors.push({ nodeId: node.id, message: 'Condition node requires a boolean expression.' });
            }
        }

        return errors;
    }
}
