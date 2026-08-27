/// <reference types="@thegreataxios/webmcp-core" />

import type { ModelContext } from "@thegreataxios/webmcp-core";

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

export {};
