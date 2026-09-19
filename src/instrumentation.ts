export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runStartupTasks } = await import("./lib/startup.server");
  await runStartupTasks();
}
