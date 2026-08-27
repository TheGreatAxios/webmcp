import type { HTMLAttributes } from "react";

type WebMCPIntrinsicElements = {
  "webmcp-provider": HTMLAttributes<HTMLElement> & {
    "data-name"?: string;
    "data-version"?: string;
  };
  "webmcp-tool": HTMLAttributes<HTMLElement> & {
    name?: string;
    description?: string;
    title?: string;
    "input-schema"?: string;
    annotations?: string;
  };
  "webmcp-journey": HTMLAttributes<HTMLElement> & {
    name?: string;
    "data-description"?: string;
  };
};

declare global {
  namespace JSX {
    interface IntrinsicElements extends WebMCPIntrinsicElements {}
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements extends WebMCPIntrinsicElements {}
  }
}

export {};
