import { create } from 'zustand';
import { BuilderState } from './builder-state';
import { Command } from '../commands/Command';
import { HistoryManager } from '../history/history-manager';
import { BuilderValidator } from '../validation/builder-validator';

interface BuilderStore extends BuilderState {
    historyManager: HistoryManager;
    
    // Actions
    dispatch: (command: Command) => void;
    undo: () => void;
    redo: () => void;
    selectNode: (id: string | null) => void;
    setValidationErrors: (errors: any[]) => void;
}

const initialState: BuilderState = {
    nodes: [],
    edges: [],
    selectedNodeId: null,
    validationErrors: [],
};

export const useBuilderStore = create<BuilderStore>((set, get) => ({
    ...initialState,
    historyManager: new HistoryManager(),

    dispatch: (command: Command) => {
        set((state) => {
            const newState = command.execute(state);
            state.historyManager.push(command);
            const validationErrors = BuilderValidator.validate(newState);
            return {
                ...newState,
                validationErrors,
            };
        });
    },
    
    undo: () => {
        set((state) => {
            const command = state.historyManager.popUndo();
            if (command) {
                const newState = command.undo(state);
                const validationErrors = BuilderValidator.validate(newState);
                return {
                    ...newState,
                    validationErrors,
                };
            }
            return state;
        });
    },

    redo: () => {
        set((state) => {
            const command = state.historyManager.popRedo();
            if (command) {
                const newState = command.execute(state);
                const validationErrors = BuilderValidator.validate(newState);
                return {
                    ...newState,
                    validationErrors,
                };
            }
            return state;
        });
    },

    selectNode: (id: string | null) => set({ selectedNodeId: id }),
    setValidationErrors: (errors: any[]) => set({ validationErrors: errors }),
}));
