import logger from './logger.js';

export function handleServiceError(
  error: unknown,
  context: object,
  message: string
): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(message, {
    error: errorMessage,
    ...context,
  });
  throw new Error(`${message}: ${errorMessage}`);
}
