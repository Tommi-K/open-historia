import assert from "node:assert/strict";
import { test } from "node:test";
import { validateGameplayPayload } from "../src/Game/AI/gameplaySchemas.js";

test("region transfers require nonblank exact ids and destination codes", () => {
  const payload = {
    summary: "The frontier changes hands.",
    impacts: {
      regionTransfers: [{ regionId: "", toCode: "BBB" }],
    },
  };

  const blankId = validateGameplayPayload("gameMaster", payload);
  assert.equal(blankId.valid, false);
  assert.match(blankId.error, /regionId.*at least 1/i);

  const blankOwner = validateGameplayPayload("gameMaster", {
    ...payload,
    impacts: { regionTransfers: [{ regionId: "AAA.1_1", toCode: "" }] },
  });
  assert.equal(blankOwner.valid, false);
  assert.match(blankOwner.error, /toCode.*at least 1/i);

  const whitespaceId = validateGameplayPayload("gameMaster", {
    ...payload,
    impacts: { regionTransfers: [{ regionId: "   ", toCode: "BBB" }] },
  });
  assert.equal(whitespaceId.valid, false);
  assert.match(whitespaceId.error, /regionId.*non-whitespace/i);

  const whitespaceOwner = validateGameplayPayload("gameMaster", {
    ...payload,
    impacts: { regionTransfers: [{ regionId: "AAA.1_1", toCode: "   " }] },
  });
  assert.equal(whitespaceOwner.valid, false);
  assert.match(whitespaceOwner.error, /toCode.*non-whitespace/i);

  assert.deepEqual(
    validateGameplayPayload("gameMaster", {
      ...payload,
      impacts: { regionTransfers: [{ regionId: "AAA.1_1", toCode: "BBB" }] },
    }),
    { valid: true, error: "" },
  );
});
