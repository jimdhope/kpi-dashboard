import test from "node:test";
import assert from "node:assert/strict";
import { datetimeLocalValueToIso, isoToDatetimeLocalValue } from "./competition-datetime";

test("datetime-local values round-trip through ISO instants", () => {
  const localValue = "2026-08-05T14:37";

  const isoValue = datetimeLocalValueToIso(localValue);

  assert.equal(isoValue, new Date(localValue).toISOString());
  assert.equal(isoValue && isoToDatetimeLocalValue(isoValue), localValue);
});

test("empty datetime-local values stay empty or null", () => {
  assert.equal(isoToDatetimeLocalValue(null), "");
  assert.equal(isoToDatetimeLocalValue(undefined), "");
  assert.equal(datetimeLocalValueToIso(""), null);
  assert.equal(datetimeLocalValueToIso("   "), null);
});
