import type { JourneyDefinition, JourneyRegistry } from "../types";

export function experimental_createJourneyRegistry(): JourneyRegistry {
  const journeys = new Map<string, JourneyDefinition>();
  const active = new Set<string>();

  return {
    register(definition) {
      journeys.set(definition.name, definition);
    },
    unregister(name) {
      journeys.delete(name);
      active.delete(name);
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
      if (isActive) active.add(name);
      else active.delete(name);
    },
  };
}

export function experimental_defineJourney(
  registry: JourneyRegistry,
  definition: JourneyDefinition,
): void {
  registry.register(definition);
}
