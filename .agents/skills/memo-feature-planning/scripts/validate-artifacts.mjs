#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const featureDir = process.argv[2];
if (!featureDir) {
  console.error("usage: validate-artifacts.mjs <feature-dir>");
  process.exit(2);
}

const required = {
  "spec.md": [
    "# Spec:",
    "## Request",
    "## User Value",
    "## User Scenarios",
    "## Functional Requirements",
    "## Success Criteria",
    "## Edge Cases",
    "## Assumptions",
    "## Non-Goals",
    "## Open Questions",
    "## Clarification Log",
    "## Quality Checklist",
  ],
  "research.md": [
    "# Research:",
    "## Freshness Check",
    "## Research Questions",
    "## Selected Research Depth",
    "## Subagent Research Plan",
    "## Subagent Results",
    "## Repository Context",
    "## Current Behavior",
    "## Relevant Files",
    "## External Or Time-Sensitive Facts",
    "## Sources",
    "## Synthesis",
    "## Constraints",
    "## Risks",
    "## Decisions",
    "## Rejected Approaches",
    "## Skipped Research",
    "## Additional Rounds",
    "## Remaining Unknowns",
  ],
  "plan.md": [
    "# Plan:",
    "## Summary",
    "## Goals",
    "## Non-Goals",
    "## User-Facing Behavior",
    "## Technical Approach",
    "## Files And Ownership",
    "## Data Or API Changes",
    "## Compatibility And Migration",
    "## Generated Files",
    "## Validation Strategy",
    "## Review Strategy",
    "## Browser QA Strategy",
    "## Commit And PR Strategy",
    "## Risks And Mitigations",
    "## Phase Overview",
    "## Decisions",
  ],
  "todo.md": [
    "# TODO:",
    "## Branch State",
    "## Execution Mode",
    "## Phase Checklist",
    "## Evidence Summary",
    "## Blockers",
  ],
  "goal-prompt.md": ["/goal"],
};

const errors = [];
const dir = resolve(process.cwd(), featureDir);
const texts = {};

for (const [file, sections] of Object.entries(required)) {
  const path = resolve(dir, file);
  if (!existsSync(path)) {
    errors.push(`${file}: missing`);
    continue;
  }
  const text = readFileSync(path, "utf8");
  texts[file] = text;
  for (const section of sections) {
    if (!text.includes(section))
      errors.push(`${file}: missing section ${section}`);
  }
}

const combined = Object.values(texts).join("\n");
const absolutePathPatterns = [
  /\/Users\/[A-Za-z0-9._-]+/g,
  /\/home\/[A-Za-z0-9._-]+/g,
  /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+/g,
];
for (const pattern of absolutePathPatterns) {
  const match = combined.match(pattern);
  if (match)
    errors.push(`artifacts: user-local absolute path found (${match[0]})`);
}

const combinedWithoutInlineCode = combined.replace(/`[^`\n]*`/g, "");
if (/\[NEEDS CLARIFICATION:\s*[^\]]+\]/.test(combinedWithoutInlineCode)) {
  errors.push("artifacts: unresolved clarification marker found");
}

const todo = texts["todo.md"] ?? "";
for (const field of ["branch:", "branch action:", "share status:"]) {
  if (!todo.toLowerCase().includes(field))
    errors.push(`todo.md: missing Branch State field ${field}`);
}
if (!/Tier [SML]:/.test(todo)) errors.push("todo.md: missing execution tier");
if (!/P\d{3}/.test(todo)) errors.push("todo.md: missing P### phase");
if (!/T\d{3}/.test(todo) && !/validation-only/i.test(todo))
  errors.push("todo.md: missing T### task");
for (const evidence of [
  "Implementation:",
  "Validation:",
  "Review:",
  "Browser QA:",
  "Commit/Push:",
  "PR/CI:",
  "Notes:",
]) {
  if (!todo.includes(evidence))
    errors.push(`todo.md: missing Evidence Summary field ${evidence}`);
}

const goal = texts["goal-prompt.md"] ?? "";
if (goal.length > 4000)
  errors.push(`goal-prompt.md: ${goal.length} characters exceeds 4000`);
const goalRequired = [
  { label: "repository root", pattern: /repository root/i },
  { label: "branch context", pattern: /branch/i },
  { label: "validation", pattern: /validation/i },
  {
    label: "phase-level subagent review",
    pattern: /phase-level subagent review|subagent review/i,
  },
  { label: "browser QA", pattern: /browser QA/i },
  {
    label: "commit/push/PR/CI",
    pattern: /commit.*push.*PR.*CI|commit\/push\/PR\/CI/i,
  },
  { label: "evidence", pattern: /evidence/i },
  { label: "stop conditions", pattern: /stop conditions|stop when/i },
  { label: "escalation", pattern: /escalation/i },
];
for (const item of goalRequired) {
  if (!item.pattern.test(goal))
    errors.push(`goal-prompt.md: missing ${item.label} rule`);
}

const forbiddenGoalPatterns = [
  {
    label: "automatic goal invocation",
    pattern: /run\s+\/goal|execute\s+\/goal|invoke\s+\/goal/i,
  },
  {
    label: "planning-run continuation",
    pattern:
      /continue (this|the) planning run|after planning.*start implementation|from this planning run/i,
  },
  {
    label: "automatic P001",
    pattern: /begin P001|start P001|implement P001/i,
  },
  {
    label: "planning package commit instruction",
    pattern: /commit the planning package|push the planning package/i,
  },
];
for (const item of forbiddenGoalPatterns) {
  if (item.pattern.test(goal))
    errors.push(`goal-prompt.md: forbidden ${item.label}`);
}

if (errors.length > 0) {
  console.error(`Artifact validation failed for ${featureDir}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Artifact validation passed for ${featureDir}.`);
