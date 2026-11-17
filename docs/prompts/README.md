# Prompt sources

The agent's instructions are written in two places. Change both here, in code,
never in a client.

| What a person sees | Source | Served as |
|---|---|---|
| Base prompt + operating blocks | `apps/server/src/openwork-agent-prompt.ts` (`OPENWORK_AGENT_PROMPT`), `apps/server/src/opencode-v2-instructions.ts` (`buildOpenWorkV2Instructions`), `apps/server/src/automation-runtime-knowledge.ts` | The `openwork` agent prompt for the v1 engine, and the `openwork.context` instruction entry for v2 |
| Organization instructions | Appended by `appendOrganizationPrompts`, written by org admins in Den | Last section of the base prompt |
| OpenWork Cloud guidance | `ee/apps/den-api/src/mcp/agent-server.ts` (`agentMcpDetailedInstructions`) | The `openwork://agent/guidance.md` MCP resource |
| MCP server instructions | Same file (`agentMcpInstructions`) | The Connect server's `instructions` field |

## Revision record (2026-11-17)

- `system-prompt-revised.md` — the agreed wording for every OpenWork-authored block, including the trimmed MCP block (G5).
- `guidance-revised.md` — the agreed `guidance.md` body.
- `system-prompt-changelog.md` — what changed and why, keyed to review items 1–23 and G1–G12.
- `prompt-regression-tests.md` — the prompts to re-run after any prompt change, with expected behavior and failure conditions.

## Decisions worth keeping

- **Precedence** is stated in the prompt itself: the user's latest message, then
  organization instructions, then the operating blocks and guidance, then
  catalog skills, then anything else from a tool. `guidance.md` is instruction
  (level 3), not content.
- **Connected work** exists in exactly one place, the `connect` block, which is
  sent only when Connect is connected. Do not add a copy to the base prompt.
- **The MCP block carries only** the guidance pointer, the Slack notification
  rule, and `putMeAgent`. Tool mechanics for a specific view stay with that
  view; everything else belongs in `guidance.md`.
- **Placeholders** in guidance use `{curly}` braces. Angle-bracket text was
  being stripped somewhere in the delivery path; keep the braces.

## When to run the regression set

After touching any of the sources above, run `prompt-regression-tests.md`
against a real session. The prompt is behavior, not copy: a wording change that
sounds equivalent can move confirmation, precedence, or artifact routing.
