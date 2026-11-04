import { init, shutdown } from "pendo-server-sdk";
import { createApp } from "./app.js";

// Pendo Agent Analytics for the Tripwise Assistant. Initialised once, before the server starts, so the
// Anthropic client's model calls are traced. Set PENDO_DISABLED=true in the environment to turn it off.
init({
  apiKey: "93f0e987-91cc-4d9d-b14f-f5c43a02bbd5",
  agentId: "PWzM9vr_TrXEni7aix0siO8RzkM",
  endpoint: "https://app.pendo-dev.pendo-dev.com",
  autoPatch: true,
});

const port = Number(process.env.PORT) || 3001;
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

createApp(corsOrigin).listen(port, () => {
  console.log(`Tripwise API on port ${port}, allowing ${corsOrigin}`);
});

// Send Pendo's buffered events before the process exits.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await shutdown();
    process.exit(0);
  });
}
