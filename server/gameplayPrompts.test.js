import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePromptPack } from "../src/Game/AI/gameplayPrompts.js";

const OWNERSHIP_TASKS = ["jumpForward", "autoJumpForward", "gameMaster"];

test("world-changing AI tasks explain the exact region ownership mechanism", () => {
  const customTasks = Object.fromEntries(
    OWNERSHIP_TASKS.map((key) => [key, `Custom ${key} prompt.\n\n--- OUTPUT FORMAT (return valid JSON only) ---`]),
  );
  const pack = normalizePromptPack({ tasks: customTasks });

  for (const key of OWNERSHIP_TASKS) {
    const prompt = pack.tasks[key];
    assert.match(prompt, /\[Region Ownership Changes\]/);
    assert.match(prompt, /impacts\.regionTransfers/);
    assert.match(prompt, /exact region id/i);
    assert.match(prompt, /one transfer object per region/i);
    assert.match(prompt, /do not invent/i);
    assert.match(prompt, /\$\{regionOwnershipReference\}/);
    assert.ok(
      prompt.indexOf("[Region Ownership Changes]") < prompt.indexOf("--- OUTPUT FORMAT"),
      `${key} should teach ownership changes before describing its output`,
    );
  }
});

test("region ownership guidance is appended only once", () => {
  const once = normalizePromptPack({ tasks: { jumpForward: "Custom jump prompt." } });
  const twice = normalizePromptPack(once);
  const headings = twice.tasks.jumpForward.match(/\[Region Ownership Changes\]/g) ?? [];

  assert.equal(headings.length, 1);
});

test("custom prompt ownership markers are completed without duplicating the inventory", () => {
  const headingOnly = normalizePromptPack({
    tasks: { gameMaster: "[Region Ownership Changes]\nUse transfers carefully." },
  }).tasks.gameMaster;
  assert.equal((headingOnly.match(/\$\{regionOwnershipReference\}/g) ?? []).length, 1);

  const referenceOnly = normalizePromptPack({
    tasks: { gameMaster: "Use this map:\n${regionOwnershipReference}" },
  }).tasks.gameMaster;
  assert.equal((referenceOnly.match(/\$\{regionOwnershipReference\}/g) ?? []).length, 1);
  assert.equal((referenceOnly.match(/\[Region Ownership Changes\]/g) ?? []).length, 1);
});
