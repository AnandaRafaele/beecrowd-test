export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startOrderProcessorCron } = await import(
      "./jobs/schedule-order-processor"
    );
    startOrderProcessorCron();
  }
}
