export interface Greeting {
  message: string;
  target: string;
  createdAt: Date;
}

export function createGreeting(target: string, message: string): Greeting {
  return {
    message,
    target,
    createdAt: new Date()
  };
}


