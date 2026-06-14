# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# Database
- Never lose API keys or user data during any database operation. Before dropping/resetting the DB, backup the keys/data first, then restore them after the operation is complete. This is a hard requirement. Confidence: 0.90

# Architecture
- Fetch rate limits dynamically from provider APIs rather than hardcoding them. Hardcoded limits get stale and don't reflect actual quotas. Confidence: 0.65
- Only support free-tier providers that don't require payment or card input. Premium/paid API keys are deferred to a later premium section. Confidence: 0.80

