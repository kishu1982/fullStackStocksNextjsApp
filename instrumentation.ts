export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const bootstrap = await import("./lib/pcr/server/bootstrap");
      if (typeof bootstrap.startPcrAutoCapture === "function") {
        bootstrap.startPcrAutoCapture();
      } else {
        console.error(
          "PCR auto-capture: bootstrap module loaded but startPcrAutoCapture is missing",
          bootstrap,
        );
      }
    } catch (err) {
      console.error("PCR auto-capture failed to start:", err);
    }
  }
}
