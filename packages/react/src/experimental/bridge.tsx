import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPageBridgeClient, type PageBridgeStatus } from "@thegreataxios/webmcp-core";

const BridgeContext = createContext<PageBridgeStatus>("disconnected");

export interface ExperimentalWebMCPBridgeProviderProps {
  token: string;
  url?: string;
  children: ReactNode;
}

/** experimental — maintains WebSocket connection to webmcp-bridge */
export function experimental_WebMCPBridgeProvider({
  token,
  url,
  children,
}: ExperimentalWebMCPBridgeProviderProps) {
  const [status, setStatus] = useState<PageBridgeStatus>("disconnected");

  useEffect(() => {
    const wsUrl = url ?? "ws://127.0.0.1:17321/ws";
    const client = createPageBridgeClient({
      url: wsUrl,
      token,
      onStatusChange: setStatus,
    });
    client.connect();
    return () => client.disconnect();
  }, [token, url]);

  return <BridgeContext.Provider value={status}>{children}</BridgeContext.Provider>;
}

export function experimental_useWebMCPBridgeStatus(): PageBridgeStatus {
  return useContext(BridgeContext);
}
