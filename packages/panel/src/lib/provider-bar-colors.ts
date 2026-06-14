/** Provider colors for the stacked capacity bar. */
export const PROVIDER_BAR_COLORS: Record<
  string,
  { charge: string; drained: string; ring: string }
> = {
  'google-gemini': {
    charge: 'bg-amber-400',
    drained: 'bg-amber-950/80',
    ring: 'ring-amber-500/40',
  },
  groq: {
    charge: 'bg-fuchsia-400',
    drained: 'bg-fuchsia-950/80',
    ring: 'ring-fuchsia-500/40',
  },
  openrouter: {
    charge: 'bg-violet-400',
    drained: 'bg-violet-950/80',
    ring: 'ring-violet-500/40',
  },
  mistral: {
    charge: 'bg-orange-400',
    drained: 'bg-orange-950/80',
    ring: 'ring-orange-500/40',
  },
  openai: {
    charge: 'bg-teal-400',
    drained: 'bg-teal-950/80',
    ring: 'ring-teal-500/40',
  },
  'openai-compat': {
    charge: 'bg-sky-400',
    drained: 'bg-sky-950/80',
    ring: 'ring-sky-500/40',
  },
  cerebras: {
    charge: 'bg-rose-400',
    drained: 'bg-rose-950/80',
    ring: 'ring-rose-500/40',
  },
  cloudflare: {
    charge: 'bg-yellow-400',
    drained: 'bg-yellow-950/80',
    ring: 'ring-yellow-500/40',
  },
  'github-models': {
    charge: 'bg-purple-400',
    drained: 'bg-purple-950/80',
    ring: 'ring-purple-500/40',
  },
  huggingface: {
    charge: 'bg-indigo-400',
    drained: 'bg-indigo-950/80',
    ring: 'ring-indigo-500/40',
  },
  'ollama-cloud': {
    charge: 'bg-cyan-400',
    drained: 'bg-cyan-950/80',
    ring: 'ring-cyan-500/40',
  },
  opencode: {
    charge: 'bg-lime-400',
    drained: 'bg-lime-950/80',
    ring: 'ring-lime-500/40',
  },
  zhipu: {
    charge: 'bg-red-400',
    drained: 'bg-red-950/80',
    ring: 'ring-red-500/40',
  },
  llm7: {
    charge: 'bg-pink-400',
    drained: 'bg-pink-950/80',
    ring: 'ring-pink-500/40',
  },
  cohere: {
    charge: 'bg-green-400',
    drained: 'bg-green-950/80',
    ring: 'ring-green-500/40',
  },
  nvidia: {
    charge: 'bg-lime-500',
    drained: 'bg-lime-950/80',
    ring: 'ring-lime-500/40',
  },
  pollinations: {
    charge: 'bg-pink-500',
    drained: 'bg-pink-950/80',
    ring: 'ring-pink-500/40',
  },
  kilo: {
    charge: 'bg-slate-400',
    drained: 'bg-slate-950/80',
    ring: 'ring-slate-500/40',
  },
};

export function providerBarColors(providerId: string) {
  return (
    PROVIDER_BAR_COLORS[providerId] ?? {
      charge: 'bg-emerald-400',
      drained: 'bg-emerald-950/80',
      ring: 'ring-emerald-500/40',
    }
  );
}
