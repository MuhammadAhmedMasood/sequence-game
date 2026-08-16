import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without this, `next dev` blocks every /_next/* script chunk request
  // whose Origin isn't localhost — the page's HTML still loads over the
  // LAN IP, but every client component chunk 403s, so nothing ever
  // hydrates (buttons/inputs silently do nothing, no visible error). This
  // is exactly what breaks the app when opened from a phone on the same
  // Wi-Fi via http://<mac-lan-ip>:3000. Wildcarded to the whole private
  // 192.168.x.x range (not just today's exact IP) since home routers
  // commonly hand out a different address on the next DHCP lease — dev
  // server only, has no effect on the production build. See:
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;
