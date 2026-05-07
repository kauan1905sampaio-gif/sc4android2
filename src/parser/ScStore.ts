/**
 * Simple in-memory store for the currently loaded SC file.
 * React Native doesn't have Redux by default so we use a simple
 * singleton + listener pattern.
 */
import type { ScFile } from './ScParser';

type Listener = (file: ScFile | null) => void;

let current: ScFile | null = null;
const listeners = new Set<Listener>();

export const ScStore = {
  get(): ScFile | null { return current; },

  set(file: ScFile | null) {
    current = file;
    listeners.forEach(l => l(file));
  },

  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  mutate(updater: (f: ScFile) => ScFile) {
    if (!current) return;
    ScStore.set(updater(current));
  },
};
