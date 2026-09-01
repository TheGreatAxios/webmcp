/// <reference path="../jsx.d.ts" />
import type { ReactNode } from "react";
import { useEffect, useReducer } from "react";
import type { JourneyDefinition } from "@thegreataxios/webmcp-core";
import { useWebMCP } from "../provider";

export interface ExperimentalWebMCPJourneyProps {
  name: string;
  description?: string;
  tools: readonly string[];
  steps?: readonly string[];
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
  const toolsKey = JSON.stringify(tools);
  const stepsKey = JSON.stringify(steps);

  useEffect(() => {
    const def: JourneyDefinition = {
      name,
      description,
      tools: [...tools],
      steps: steps ? [...steps] : undefined,
    };
    journeyRegistry.register(def);
    return () => journeyRegistry.unregister(name);
  }, [journeyRegistry, name, description, toolsKey, stepsKey]);

  useEffect(() => {
    journeyRegistry.setJourneyActive(name, when);
    return () => journeyRegistry.setJourneyActive(name, false);
  }, [journeyRegistry, name, when, toolsKey, stepsKey]);

  if (!when) return null;

  return <webmcp-journey name={name} data-description={description ?? ""}>{children}</webmcp-journey>;
}

export function experimental_useWebMCPJourney() {
  const { journeyRegistry } = useWebMCP();
  const [, refresh] = useReducer((version) => version + 1, 0);

  useEffect(() => journeyRegistry.addChangeListener(refresh), [journeyRegistry]);

  return {
    activeJourneys: journeyRegistry.getActiveJourneys().map((j) => j.name),
    isToolExposed: (toolName: string) => journeyRegistry.isToolExposed(toolName),
  };
}
