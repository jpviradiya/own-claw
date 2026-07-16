import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const getAgentModel = () => {
  // providing openrouter api key to access model
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  // defining which model types it must use (in our case free models)
  const modelId = process.env.OPENROUTER_DEFAULT_MODEL!;

  // The provider is a factory function. Calling it with a model ID returns a ready-to-use language model.
  return provider(modelId);
};
