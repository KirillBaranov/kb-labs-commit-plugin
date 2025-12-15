import { z } from 'zod';

export const HelloCommandInputSchema = z.object({
  name: z.string().min(1, 'name cannot be empty').optional()
});

export type HelloCommandInput = z.infer<typeof HelloCommandInputSchema>;

export const HelloCommandOutputSchema = z.object({
  message: z.string(),
  target: z.string()
});

export type HelloCommandOutput = z.infer<typeof HelloCommandOutputSchema>;

export const HelloGreetingSchema = HelloCommandOutputSchema;

export type HelloGreeting = HelloCommandOutput;

