export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDemoReady } = await import("./src/lib/bootstrap-demo");
    try {
      await ensureDemoReady();
    } catch (err) {
      console.error("[CrewOS] Demo bootstrap failed:", err);
    }
  }
}
