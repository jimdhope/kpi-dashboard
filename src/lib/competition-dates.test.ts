import test from "node:test";
import assert from "node:assert/strict";
import { toCompetitionDateRange } from "./competition-dates";

test("endDate is persisted as the very end of the picked local day", () => {
  // Calendar picks arrive at local midnight.
  const picked = new Date(2026, 7, 30); // Aug 30 2026, 00:00 local
  const { endsAt } = toCompetitionDateRange(picked, picked);

  const parsed = new Date(endsAt);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 7);
  assert.equal(parsed.getDate(), 30, "end date must stay on the picked calendar day");
  assert.equal(parsed.getHours(), 23);
  assert.equal(parsed.getMinutes(), 59);
  assert.equal(parsed.getSeconds(), 59);
});

test("startDate is persisted as local midnight of the picked day", () => {
  const start = new Date(2026, 7, 24);
  const end = new Date(2026, 7, 30);
  const { startsAt } = toCompetitionDateRange(start, end);

  const parsed = new Date(startsAt);
  assert.equal(parsed.getDate(), 24);
  assert.equal(parsed.getHours(), 0);
  assert.equal(parsed.getMinutes(), 0);
});

test("round-trips through ISO strings without shifting calendar days", () => {
  const start = new Date(2026, 7, 24);
  const end = new Date(2026, 7, 30);
  const range = toCompetitionDateRange(start, end);

  // Simulate a JSON API boundary
  const revived = {
    startsAt: new Date(JSON.parse(JSON.stringify(range.startsAt))),
    endsAt: new Date(JSON.parse(JSON.stringify(range.endsAt))),
  };
  assert.equal(revived.startsAt.toDateString(), start.toDateString());
  assert.equal(revived.endsAt.toDateString(), end.toDateString());
});
