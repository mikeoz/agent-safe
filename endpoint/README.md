# Verification Endpoint — Control 1: The Front Door

Every AI agent that wants to reach data protected by Opn.li Agent Safe
must call this endpoint first.

The door asks two questions:
1. Is this agent registered? (Entity CARD check)
2. Does it have a permission slip? (Use CARD check)

If no to either — access denied.
If yes — the agent gets exactly what the permission slip says. Nothing more.

## Live endpoint

https://biejnguqnejzwmypotez.supabase.co/functions/v1/verify-card

## Try it
