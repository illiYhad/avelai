// K-AV-AVE.soon: AVE readiness + model name (server-side only · the key never leaves the server · pages get a boolean)
export const AVE_DEFAULT_MODEL = "llama-3.3-70b-versatile";

type Env = Record<string, string | undefined>;

/** true = GROQ_API_KEY is set and not blank */
export function isAveConfigured(env: Env = process.env): boolean {
  return Boolean(env.GROQ_API_KEY?.trim());
}

/** AVE_MODEL when set and not blank, otherwise the default model */
export function aveModel(env: Env = process.env): string {
  const m = env.AVE_MODEL?.trim();
  return m ? m : AVE_DEFAULT_MODEL;
}
