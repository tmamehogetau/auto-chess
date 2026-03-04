// Vitest setup file for Node.js environment
// This file runs before each test file to set up global objects needed by Colyseus SDK

import WebSocket from "ws";

// Polyfill WebSocket for Node.js environment
// Colyseus SDK's reconnect() requires WebSocket to be defined globally
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as any).WebSocket = WebSocket;
}
