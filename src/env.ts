export type RuntimeEnv = Record<string, string | undefined>;

export function bindRuntimeEnv(env: RuntimeEnv | undefined) {
  if (env && typeof env === 'object') {
    // Store on global to be readable anywhere
    (globalThis as any).__ENV = env;
    // Best-effort: if process.env exists, mirror keys (Workers node compat may ignore)
    try {
      const proc: any = (globalThis as any).process;
      if (proc && proc.env) {
        for (const [k, v] of Object.entries(env)) {
          if (typeof v === 'string') proc.env[k] = v;
        }
      }
    } catch {}
  }
}

export function getEnvVar(name: string): string | undefined {
  const env = (globalThis as any).__ENV as RuntimeEnv | undefined;
  return (env && env[name]) || (typeof process !== 'undefined' ? (process.env as any)?.[name] : undefined);
}


