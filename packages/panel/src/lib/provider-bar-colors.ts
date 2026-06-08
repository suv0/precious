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
  'openai-compat': {
    charge: 'bg-sky-400',
    drained: 'bg-sky-950/80',
    ring: 'ring-sky-500/40',
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
