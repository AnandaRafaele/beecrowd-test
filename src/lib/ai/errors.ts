function getChatErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("insufficient_quota") ||
    message.includes("exceeded your current quota")
  ) {
    return "OpenAI API quota exceeded. Add billing or credits at platform.openai.com and update OPENAI_API_KEY in .env.";
  }

  if (message.includes("Incorrect API key") || message.includes("invalid_api_key")) {
    return "Invalid OpenAI API key. Check OPENAI_API_KEY in your .env file.";
  }

  return message || "An error occurred while contacting the AI provider.";
}

export { getChatErrorMessage };
