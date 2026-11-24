//! L3 composition root for `webmcp-bridge` — wires localhost WebSocket relay + MCP stdio/HTTP.

use std::process;
use std::sync::Arc;

use clap::Parser;
use webmcp_auth::{generate_bridge_token, resolve_bridge_config_from_env};
use webmcp_mcp::{McpServerInfo, build_mcp_http_router, run_stdio_server};
use webmcp_policy::BridgeConfig;
use webmcp_protocol::BridgeHub;
use webmcp_ws::{PageSessionHub, serve_ws};

#[derive(Debug, Parser)]
#[command(
    name = "webmcp-bridge",
    version,
    about = "Localhost WebSocket <-> MCP (stdio / Streamable HTTP) bridge for W3C WebMCP"
)]
struct Cli {
    /// Localhost bind address (defaults to WEBMCP_BRIDGE_HOST or 127.0.0.1)
    #[arg(long)]
    host: Option<String>,

    /// Localhost bind port (defaults to WEBMCP_BRIDGE_PORT or 17321)
    #[arg(long)]
    port: Option<u16>,

    /// Shared auth token (defaults to WEBMCP_BRIDGE_TOKEN, min 32 chars)
    #[arg(long)]
    token: Option<String>,

    /// Comma-separated allowed Origin headers (defaults to WEBMCP_BRIDGE_ORIGINS)
    #[arg(long, value_delimiter = ',')]
    allowed_origins: Option<Vec<String>>,

    /// Also expose MCP Streamable HTTP on POST /mcp on the same localhost server
    #[arg(long, default_value_t = false)]
    http_mcp: bool,

    /// Disable stdio MCP server (useful when running with --http-mcp standalone)
    #[arg(long, default_value_t = false)]
    no_stdio: bool,

    /// Print a fresh 256-bit random token and exit
    #[arg(long, default_value_t = false)]
    generate_token: bool,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    if cli.generate_token {
        println!("{}", generate_bridge_token());
        return;
    }

    let env_cfg = resolve_bridge_config_from_env();
    let config = BridgeConfig {
        host: cli.host.unwrap_or(env_cfg.host),
        port: cli.port.unwrap_or(env_cfg.port),
        token: cli.token.unwrap_or(env_cfg.token),
        allowed_origins: cli.allowed_origins.unwrap_or(env_cfg.allowed_origins),
    };

    if let Err(err) = config.validate() {
        eprintln!("[webmcp-bridge] configuration error: {err}");
        process::exit(2);
    }

    let hub = PageSessionHub::new();
    let (addr, listener, ws_router) = match serve_ws(hub.clone(), config).await {
        Ok(parts) => parts,
        Err(err) => {
            eprintln!("[webmcp-bridge] failed to bind localhost server: {err}");
            process::exit(1);
        }
    };

    let info = McpServerInfo::default();
    let hub_dyn: Arc<dyn BridgeHub> = Arc::new(hub);

    let router = if cli.http_mcp {
        ws_router.merge(build_mcp_http_router(Arc::clone(&hub_dyn), info.clone()))
    } else {
        ws_router
    };

    eprintln!("[webmcp-bridge] listening on ws://{addr}/ws");
    if cli.http_mcp {
        eprintln!("[webmcp-bridge] MCP Streamable HTTP enabled on http://{addr}/mcp");
    }

    let server_task = tokio::spawn(async move {
        if let Err(err) = axum::serve(listener, router).await {
            eprintln!("[webmcp-bridge] server error: {err}");
        }
    });

    if cli.no_stdio {
        let _ = tokio::signal::ctrl_c().await;
    } else if let Err(err) = run_stdio_server(hub_dyn, info).await {
        eprintln!("[webmcp-bridge] stdio error: {err}");
    }

    server_task.abort();
}
