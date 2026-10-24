import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
export function attachProxyTransport(server, { origin, enabled = true }) {
  if (!enabled) return;
  logging.set_level(logging.ERROR);
  Object.assign(wisp.options, {
    allow_private_ips: false,
    allow_loopback_ips: false,
    allow_direct_ip: false,
    allow_udp_streams: false,
    port_whitelist: [80, 443],
    stream_limit_per_host: 12,
    stream_limit_total: 48,
    parse_real_ip: false,
  });
  const connections = new Map();
  server.on("upgrade", (req, socket, head) => {
    const path = new URL(req.url, origin).pathname;
    const ip = req.socket.remoteAddress || "unknown";
    if (
      path !== "/wisp/" ||
      req.headers.origin !== origin ||
      (connections.get(ip) || 0) >= 6
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    connections.set(ip, (connections.get(ip) || 0) + 1);
    socket.once("close", () => {
      const n = (connections.get(ip) || 1) - 1;
      n ? connections.set(ip, n) : connections.delete(ip);
    });
    try {
      wisp.routeRequest(req, socket, head);
    } catch {
      socket.destroy();
    }
  });
}
