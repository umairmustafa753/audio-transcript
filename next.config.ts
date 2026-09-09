import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // onnxruntime-node and sharp are Node-only fallbacks inside transformers.js. The
  // browser build never touches them, but they must not be pulled into a bundle.
  serverExternalPackages: ["@huggingface/transformers"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Cross-origin isolation unlocks SharedArrayBuffer, which lets the
          // ONNX WASM backend run Whisper across several threads.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
