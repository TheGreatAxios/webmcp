/// <reference path="../jsx.d.ts" />
import type { ReactNode } from "react";
import {
  experimental_createJourneyRegistry,
  type JourneyDefinition,
} from "@thegreataxios/webmcp-core";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const JourneyContext = createContext<{
  registry: ReturnType<typeof experimental_createJourneyRegistry>;
  active: string[];
} | null>(null);

export interface ExperimentalWebMCPJourneyProps {
  name: string;
  description?: string;
  tools: string[];
  steps?: string[];
  when?: boolean;
  children?: ReactNode;
}

/**
 * experimental — phase-scoped tool exposure (W3C skills #161).
 */
export function experimental_WebMCPJourney({
  name,
  description,
  tools,
  steps,
  when = true,
  children,
}: ExperimentalWebMCPJourneyProps) {
  const ctx = useContext(JourneyContext);
  const active = when;

  useEffect(() => {
    if (!ctx) return;
    const def: JourneyDefinition = { name, description, tools, steps };
    ctx.registry.register(def);
    ctx.registry.setJourneyActive(name, active);
    return () => {
      ctx.registry.setJourneyActive(name, false);
      ctx.registry.unregister(name);
    };
  }, [ctx, name, description, tools, steps, active]);

  if (!when) return null;

  return (
    <webmcp-journey name={name} data-description={description ?? ""}>
      {children}
    </webmcp-journey>
  );
}

export function experimental_WebMCPJourneyProvider({ children }: { children: ReactNode }) {
  const registry = useMemo(() => experimental_createJourneyRegistry(), []);
  const [active, setActive] = useState<string[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive(registry.getActiveJourneys().map((j) => j.name));
    }, 100);
    return () => clearInterval(interval);
  }, [registry]);

  return (
    <JourneyContext.Provider value={{ registry, active }}>
      {children}
    </JourneyContext.Provider>
  );
}

export function experimental_useWebMCPJourney() {
  const ctx = useContext(JourneyContext);
  return {
    activeJourneys: ctx?.active ?? [],
    isToolExposed: (toolName: string) => ctx?.registry.isToolExposed(toolName) ?? true,
  };
}
