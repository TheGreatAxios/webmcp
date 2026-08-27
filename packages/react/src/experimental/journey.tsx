/// <reference path="../jsx.d.ts" />
import type { ReactNode } from "react";
import { useEffect } from "react";
import type { JourneyDefinition } from "@thegreataxios/webmcp-core";
import { useWebMCP } from "../provider";

export interface ExperimentalWebMCPJourneyProps {
  name: string;
  description?: string;
  tools: string[];
  steps?: string[];
  when?: boolean;
  children?: ReactNode;
}

/** experimental — phase-scoped tool exposure (W3C #161) */
export function experimental_WebMCPJourney({
  name,
  description,
  tools,
  steps,
  when = true,
  children,
}: ExperimentalWebMCPJourneyProps) {
  const { journeyRegistry } = useWebMCP();

  useEffect(() => {
    const def: JourneyDefinition = { name, description, tools, steps };
    journeyRegistry.register(def);
    journeyRegistry.setJourneyActive(name, when);
    return () => {
      journeyRegistry.setJourneyActive(name, false);
      journeyRegistry.unregister(name);
    };
  }, [journeyRegistry, name, description, tools, steps, when]);

  if (!when) return null;

  return <webmcp-journey name={name} data-description={description ?? ""}>{children}</webmcp-journey>;
}

export function experimental_useWebMCPJourney() {
  const { journeyRegistry } = useWebMCP();
  return {
    activeJourneys: journeyRegistry.getActiveJourneys().map((j) => j.name),
    isToolExposed: (toolName: string) => journeyRegistry.isToolExposed(toolName),
  };
}
