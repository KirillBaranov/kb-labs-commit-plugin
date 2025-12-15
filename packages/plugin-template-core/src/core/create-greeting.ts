import { createGreeting } from './greeting';
import { DEFAULT_GREETING_TARGET } from '../utils/index';

export interface CreateGreetingInput {
  name?: string;
  message?: string;
}

export function createGreetingUseCase(input: CreateGreetingInput = {}) {
  const target = input.name?.trim() || DEFAULT_GREETING_TARGET;
  const message = input.message ?? `Hello, ${target}!`;

  return createGreeting(target, message);
}


