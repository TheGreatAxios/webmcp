import type { JourneyDefinition, JourneyRegistry } from "../types";

export function experimental_createJourneyRegistry(): JourneyRegistry {
  const journeys = new Map<string, JourneyDefinition>();
  const active = new Set<string>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    register(definition) {
      journeys.set(definition.name, definition);
      notify();
    },
    unregister(name) {
      if (!journeys.has(name)) return;
      journeys.delete(name);
      active.delete(name);
      notify();
    },
    getActiveJourneys() {
      return Array.from(active)
        .map((name) => journeys.get(name))
        .filter((j): j is JourneyDefinition => j != null);
    },
    isToolExposed(toolName) {
      if (active.size === 0) return true;
      for (const name of active) {
        const journey = journeys.get(name);
        if (journey?.tools.includes(toolName)) return true;
      }
      return false;
    },
    setJourneyActive(name, isActive) {
      if (!journeys.has(name)) return;
      const changed = isActive ? !active.has(name) : active.has(name);
      if (!changed) return;
      if (isActive) active.add(name);
      else active.delete(name);
      notify();
    },
    addChangeListener(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function experimental_defineJourney(
  registry: JourneyRegistry,
  definition: JourneyDefinition,
): void {
  registry.register(definition);
}
