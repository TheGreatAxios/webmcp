//! Origin allowlist checks (bridge WS) and W3C WebMCP two-sided cross-origin tool visibility.

/// Check whether an HTTP `Origin` header is allowed to connect to the localhost bridge.
///
/// When `allowed` is empty, only `http(s)://localhost[:port]` and `http(s)://127.0.0.1[:port]`
/// (and `[::1]`) are permitted. A missing `Origin` header (non-browser local client) is allowed.
pub fn is_origin_allowed(origin: Option<&str>, allowed: &[String]) -> bool {
    let Some(origin) = origin else {
        return true;
    };
    if !allowed.is_empty() {
        return allowed.iter().any(|a| a == origin);
    }
    is_localhost_origin(origin)
}

fn is_localhost_origin(origin: &str) -> bool {
    let rest = if let Some(r) = origin.strip_prefix("http://") {
        r
    } else if let Some(r) = origin.strip_prefix("https://") {
        r
    } else {
        return false;
    };

    // Disallow paths, queries, or userinfo in an Origin header.
    if rest.contains('/') || rest.contains('?') || rest.contains('#') || rest.contains('@') {
        return false;
    }

    let (host, port_opt) = if let Some(bracket_rest) = rest.strip_prefix("[::1]") {
        if bracket_rest.is_empty() {
            ("[::1]", None)
        } else if let Some(port) = bracket_rest.strip_prefix(':') {
            ("[::1]", Some(port))
        } else {
            return false;
        }
    } else if let Some((h, p)) = rest.split_once(':') {
        (h, Some(p))
    } else {
        (rest, None)
    };

    let host_ok = matches!(host, "localhost" | "127.0.0.1" | "[::1]");
    let port_ok = match port_opt {
        None => true,
        Some(p) => !p.is_empty() && p.parse::<u16>().is_ok(),
    };
    host_ok && port_ok
}

/// W3C WebMCP Section 6.3.4 two-sided opt-in check for cross-origin tool exposure.
///
/// - Same-origin tools are always visible unless `from_origins` explicitly excludes them.
/// - Cross-origin tools require BOTH:
///   1. The registering tool opted in via `exposed_to` containing `caller_origin` or `"*"`.
///   2. The caller opted in via `from_origins` containing `tool_origin` or `"*"`.
pub fn is_tool_visible_to_caller(
    caller_origin: &str,
    tool_origin: &str,
    exposed_to: &[String],
    from_origins: Option<&[String]>,
) -> bool {
    let caller_wants = match from_origins {
        None => caller_origin == tool_origin,
        Some(origins) => origins.iter().any(|o| o == "*" || o == tool_origin),
    };
    if !caller_wants {
        return false;
    }
    if caller_origin == tool_origin {
        return true;
    }
    exposed_to.iter().any(|o| o == "*" || o == caller_origin)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn localhost_origin_prevents_subdomain_bypass() {
        assert!(is_origin_allowed(Some("http://localhost:43114"), &[]));
        assert!(is_origin_allowed(Some("https://127.0.0.1:8080"), &[]));
        assert!(is_origin_allowed(Some("http://[::1]:3000"), &[]));
        assert!(is_origin_allowed(None, &[]));

        assert!(!is_origin_allowed(Some("http://localhost.evil.com"), &[]));
        assert!(!is_origin_allowed(Some("http://127.0.0.1.evil.com"), &[]));
        assert!(!is_origin_allowed(Some("https://example.com"), &[]));
        assert!(!is_origin_allowed(Some("http://localhost:99999"), &[]));
        assert!(!is_origin_allowed(Some("http://localhost/path"), &[]));
    }

    #[test]
    fn explicit_allowlist_overrides_default() {
        let allow = vec!["https://app.example.com".to_string()];
        assert!(is_origin_allowed(Some("https://app.example.com"), &allow));
        assert!(!is_origin_allowed(Some("http://localhost:3000"), &allow));
    }

    #[test]
    fn two_sided_cross_origin_opt_in() {
        let caller = "https://host.example";
        let frame = "https://embed.example";

        // Same-origin visible by default
        assert!(is_tool_visible_to_caller(caller, caller, &[], None));

        // Cross-origin hidden if either side doesn't opt in
        assert!(!is_tool_visible_to_caller(caller, frame, &[], None));
        assert!(!is_tool_visible_to_caller(
            caller,
            frame,
            &[caller.into()],
            None
        ));
        assert!(!is_tool_visible_to_caller(
            caller,
            frame,
            &[],
            Some(&[frame.into()])
        ));

        // Visible when both opt in
        assert!(is_tool_visible_to_caller(
            caller,
            frame,
            &[caller.into()],
            Some(&[frame.into()])
        ));
        assert!(is_tool_visible_to_caller(
            caller,
            frame,
            &["*".into()],
            Some(&["*".into()])
        ));
    }
}
