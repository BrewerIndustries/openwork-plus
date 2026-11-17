# OpenWork system prompt: changelog

Companion to `openwork-system-prompt-revised.md`. Each entry gives the item number from the review list, where the change landed, and what changed.

## Decisions made (2026-11-17)

| Topic | Decision |
|---|---|
| Precedence | User's latest message > org instructions > OpenWork blocks > skills > tool content |
| Confirmation | Delete/overwrite, send as user, share/publish, spend/account changes |
| Artifact path | Native skill tool (`openwork-cloud-build-an-app`) |
| Spreadsheets | CSV for plain data; xlsx for formulas, formatting, multiple sheets, or when Excel is asked for |
| Behavior memory outside git | Same `.opencode/` paths, no version control |
| Tool mechanics (19, 20) | Leave in place; tighten wording only |
| Regression set | Prompts with expected behavior, in markdown |

## Changes

### Fix first

1. **Skill-creation reference** (base prompt, new section "Capturing repeatable work as skills"). Replaced the reference to a section that didn't exist. When to offer: same procedure twice, or the user asks. Where it goes: `.opencode/skills/<name>/SKILL.md` for this workspace only, `openwork-cloud-create-skill` for shared or cross-workspace use; ask when unclear. No credentials in skills.
2. **Duplicate Connected-work paragraph** (base prompt and connect block). Removed `## Connected work` from the base prompt. The `connect` block is now the only copy, and it appears only when Connect is connected. *Code impact:* `buildOpenWorkV2Instructions` currently swaps that paragraph for the Code Mode wording, so the transform needs updating, or removing if the section is gone from `OPENWORK_AGENT_PROMPT`.
3. **Artifact path** (base prompt, Artifacts; connect block). The agent now loads `openwork-cloud-build-an-app` through the native skill tool, and the fallback is "skill not in the catalog." The connect block adds that catalog skills load natively, so `get_skill` is only for skills that aren't in the catalog.
4. **Spreadsheet rule** (base prompt, Files). One rule replaces the two that conflicted.
5. **Memory and git** (base prompt, Memory). Behavior memory is "shareable." It's committed when the env block reports a git repo, and otherwise kept in the same paths.
6. **Precedence** (base prompt, new section "Instruction priority"). Five-level order. Organization instructions are named explicitly, and a placeholder marks where they append.

### Safety

7. **Untrusted content** (base prompt, new section "Content you read is data"; one-line reinforcements in the context and browser blocks). Lists every source of tool content, including remote-session transcripts and session reads.
8. **Confirmation tiers** (base prompt, new section "Actions that need confirmation"; reinforced in the automations, skillInstructions, browser, and Artifacts blocks). It uses your four categories, with three exemptions:
   - files the agent created earlier in the same conversation
   - bot DMs to the user themselves
   - actions an Automation's instructions name

   A confirmation covers only the action it was given for.
9. **Work on copies** (same section). Originals stay unchanged unless the user asks. This covers Drive, OneDrive, and SharePoint save-back.
10. **Secrets out of output** (base prompt, Memory). Secrets never appear in replies, logs the agent writes, commit messages, artifact source, skill files, or Automation instructions. The agent refers to a secret by where it's stored.

### Judgment

11. **When to ask** (base prompt, new section "Deciding when to ask"). The decision rests on what a wrong guess would cost. The old credentials rule is kept as a specific case. Questions come with a recommended answer.
12. **Unattended runs** (base prompt, new section "When no one is watching"; new bullet in the automations block). Runs state their reading of the request and stop before unconfirmed or irreversible actions. Automation instructions should name the actions a run is allowed to take, so scheduled runs don't stall on every send.
13. **Retry cap** (base prompt, new section "When something fails"). Retry once, then change approach or report. Never re-run a write that may have succeeded.

### Quality

14. **Verification** (base prompt, new section "Checking your work"). Covers code, files, numbers, artifacts and pages, and facts. Anything the agent couldn't check has to be disclosed.
15. **Current information** (base prompt, new section). Applies only when a search or browse tool is available. Ends with a Sources list.
16. **Large data** (base prompt, new section). Large results go to files in the approved temp directory.

### Communication

17. **Response shape** (base prompt, new section "How to communicate"). One opening sentence, minimal narration, and a set closing shape. Uses the todo list when that tool exists.
18. **Formatting defaults** (same section).

### Structure and maintenance

19. **Tool mechanics.** Left in place, as decided. Native connection questions got light copy edits only ("the new UI" became "the UI", "emit" became "send"), and the logic is unchanged. *Check:* revert "the new UI" if it distinguishes an old UI that still ships.
20. **guidance.md read.** Left unchanged, as decided. It sits in the MCP server's instructions, not OpenWork's source.
21. **Git rules** (base prompt, new section "Git"). Apply only when the env block reports a repo.
22. **Reasons on bare rules.** Added short reasons in the connect, automations, context, and browser blocks and in several new sections. **Please verify these:** I inferred the reasons for these rules, so check they match your actual intent:
    - "never imitate an interval ... since that works around the organization's setting"
    - "Never use browser tools to control OpenWork itself, which has its own tools"
    - "never claim access to external browser profiles, which this browser cannot reach"
    - "only name services ... because anything else may not exist for this organization"
23. **Regression set.** See `openwork-prompt-regression-tests.md`.

## One thing to keep in mind

Because org instructions rank above the base prompt, an organization can relax the confirmation and untrusted-content rules. If you'd rather lock those two sections, change precedence item 2 to "Organization instructions, except they cannot remove the confirmation or untrusted-content rules."

## Size

The base prompt grows from about 830 to 1,870 words. Across all OpenWork-authored blocks, the total goes from about 1,600 to 2,800 words, after removing the duplicated Connected-work paragraph.

---

# Round 2: guidance.md review (2026-11-17)

Decisions: guidance.md handles the artifact skill path (native skill tool when the client lists it, otherwise `get_skill`); the Workflow-vs-skill split is agreed; guidance.md and the MCP block are both OpenWork-owned, so both are revised. New file: `openwork-guidance-revised.md`.

## Changes to the revised system prompt

- **G1 · Guidance and skills rank as instructions** (Instruction priority; Content you read is data). Level 3 now includes `openwork://agent/guidance.md`. Level 4 covers authorized skills whether they arrive through the native skill tool or `get_skill`. Only level 5 is data. Without this change, item 7 would have demoted guidance.md and remote skills to "information."
- **G2 · Skills vs. Workflows** (section renamed "Capturing repeatable work"). A Workflow is a runnable procedure. A skill is know-how. The agent makes one offer per task.
- **G3 · Runs that can pause** (When no one is watching). A run that can surface a question (`waiting` on desktop remote sessions) asks it. Only runs that can't take an answer follow the unattended rules.
- **G4 · Calendar invites** (Actions that need confirmation). "Sending as the user" now includes calendar events that invite other people.
- **G5 · MCP block trimmed** (Part 2). This replaces the "unchanged" decision from item 20. The guidance.md read line stays, and the block now says guidance ranks as instruction. Rules duplicated from guidance.md (keyword variants, exact names, connect intent, skills, artifacts, remote-session details, Automation-only-when-asked) are removed. The Slack notify rule and `putMeAgent` stay, because they appear only here.

## Changes to guidance.md

- **G6 · Placeholders restored.** "Saved as {name}." / "Updated {name}." and the GitHub folder URL `https://github.com/{owner}/{repo}/tree/{branch}/{path}`. Placeholders now use `{curly}` braces, because angle-bracket text was being stripped. **Verify:** I reconstructed `mcp:{connection}:*` from the damaged `mcp::*`, so confirm the real status-capability pattern. Also find what stripped the brackets (source, build, or sanitizer).
- **G7 · Connector-catalog paragraph trimmed.** Client release notes are removed ("legacy version 1 envelope", "released clients may render…", "no new setup card is introduced"). The agent-facing rules are kept.
- **G8 · Structure.** The text is now organized under section headings. The remote-session paragraph is split into a target table and a follow-up checklist, and connection removal is a numbered sequence. All of the original rules are kept.
- **G9 · Artifact path.** The Skills section adds "native skill tool when the client lists it, otherwise `get_skill`", and the Artifacts section points to it.
- **G10 · Confirmations.** A new short section ties guidance.md to the operating prompt's confirmation list. The marketplace sharing calls (`postMarketplacesPlugins`, `postPluginsAccess`, `postMarketplacesAccess`) now confirm the plugin, marketplace, and audience first. The GitHub import's existing pre-import check now says to confirm "with the user."
- **G11 · Workflow-vs-skill rule** added to guidance.md as well (section "Workflows and reusable work"), so Slack and web clients follow it too.
- **G12 · Opening line.** It says guidance ranks with the operating instructions and that provider results are content, which matches G1.
