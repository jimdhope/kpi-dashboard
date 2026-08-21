import test from "node:test";
import assert from "node:assert/strict";
import {
  BYB_HISTORY_WINDOW,
  BYB_MIN_PRIOR_COMPETITIONS,
  computeBybStandings,
  resolveBybPrimaryPod,
  selectBybPodChampions,
  type BybPlayerHistory,
} from "./beat-your-best";

function history(totals: number[], participated?: boolean[]): BybPlayerHistory {
  return {
    totals,
    participated: participated ?? totals.map((total) => total > 0),
  };
}

test("ratio is raw points over rolling best times 100", () => {
  const result = computeBybStandings({
    currentWeek: [{ userId: "a", name: "Alice", rawPoints: 110 }],
    historyByUser: new Map([["a", history([100, 90, 80])]]),
  });
  assert.equal(result.standings[0].rollingBest, 100);
  assert.equal(result.standings[0].ratio, 110);
  assert.equal(result.standings[0].rank, 1);
  assert.equal(result.standings[0].qualified, true);
});

test("rolling best uses only the last eight scoring weeks", () => {
  const totals = [500, ...new Array(8).fill(0).map((_, index) => 50 + index)];
  const result = computeBybStandings({
    currentWeek: [{ userId: "a", name: "Alice", rawPoints: 60 }],
    historyByUser: new Map([["a", history(totals)]]),
  });
  assert.equal(result.standings[0].rollingBest, 57);
});

test("zero-score weeks never enter the rolling best window", () => {
  const result = computeBybStandings({
    currentWeek: [{ userId: "a", name: "Alice", rawPoints: 40 }],
    historyByUser: new Map([["a", history([0, 0, 30, 0, 20], [true, true, true, true, true])]]),
  });
  assert.equal(result.standings[0].rollingBest, 30);
  assert.equal(result.standings[0].ratio, 133.3);
});

test("players with fewer than three prior competitions are unranked", () => {
  const result = computeBybStandings({
    currentWeek: [
      { userId: "a", name: "Newcomer", rawPoints: 120 },
      { userId: "b", name: "Veteran", rawPoints: 100 },
    ],
    historyByUser: new Map([
      ["a", history([200, 150])],
      ["b", history([100, 90, 80])],
    ]),
  });
  const newcomer = result.standings.find((standing) => standing.userId === "a")!;
  const veteran = result.standings.find((standing) => standing.userId === "b")!;
  assert.equal(newcomer.ranked, false);
  assert.equal(newcomer.ratio, null);
  assert.equal(newcomer.rank, null);
  assert.equal(veteran.rank, 1);
});

test("participation counts toward the minimum even without points", () => {
  const result = computeBybStandings({
    currentWeek: [{ userId: "a", name: "Alice", rawPoints: 50 }],
    historyByUser: new Map([["a", history([0, 0, 40], [true, true, true])]]),
  });
  assert.equal(result.standings[0].ranked, true);
  assert.equal(result.standings[0].rollingBest, 40);
});

test("players with three prior competitions but no scoring weeks are unranked", () => {
  const result = computeBybStandings({
    currentWeek: [{ userId: "a", name: "Alice", rawPoints: 50 }],
    historyByUser: new Map([["a", history([0, 0, 0], [true, true, true])]]),
  });
  assert.equal(result.standings[0].ranked, false);
  assert.equal(result.standings[0].rollingBest, null);
  assert.equal(result.standings[0].ratio, null);
});

test("qualification floor excludes players below half the top raw score", () => {
  const result = computeBybStandings({
    currentWeek: [
      { userId: "a", name: "Alice", rawPoints: 100 },
      { userId: "b", name: "Bob", rawPoints: 49 },
      { userId: "c", name: "Carol", rawPoints: 50 },
    ],
    historyByUser: new Map([
      ["a", history([100, 100, 100])],
      ["b", history([10, 10, 10])],
      ["c", history([10, 10, 10])],
    ]),
  });
  const alice = result.standings.find((standing) => standing.userId === "a")!;
  const bob = result.standings.find((standing) => standing.userId === "b")!;
  const carol = result.standings.find((standing) => standing.userId === "c")!;
  assert.equal(carol.qualified, true);
  assert.equal(carol.rank, 1);
  assert.equal(alice.rank, 2);
  assert.equal(bob.qualified, false);
  assert.equal(bob.ranked, true);
  assert.equal(bob.rank, null);
});

test("highest ratio wins and ties break on raw points then name", () => {
  const historyFor = (best: number): BybPlayerHistory => history([best, best, best]);
  const result = computeBybStandings({
    currentWeek: [
      { userId: "a", name: "Alice", rawPoints: 100 },
      { userId: "b", name: "Bob", rawPoints: 120 },
      { userId: "c", name: "Carol", rawPoints: 100 },
      { userId: "d", name: "Dave", rawPoints: 100 },
    ],
    historyByUser: new Map([
      ["a", historyFor(100)],
      ["b", historyFor(120)],
      ["c", historyFor(100)],
      ["d", historyFor(50)],
    ]),
  });
  assert.deepEqual(result.standings.map((standing) => standing.userId), ["d", "b", "a", "c"]);
  assert.deepEqual(result.standings.map((standing) => standing.rank), [1, 2, 3, 4]);
});

test("unqualified ranked players sort by raw points below the qualified field", () => {
  const result = computeBybStandings({
    currentWeek: [
      { userId: "a", name: "Alice", rawPoints: 100 },
      { userId: "b", name: "Bob", rawPoints: 30 },
      { userId: "c", name: "Carol", rawPoints: 20 },
    ],
    historyByUser: new Map([
      ["a", history([100, 100, 100])],
      ["b", history([300, 300, 300])],
      ["c", history([300, 300, 300])],
    ]),
  });
  assert.deepEqual(result.standings.map((standing) => standing.userId), ["a", "b", "c"]);
  assert.equal(result.standings[1].rank, null);
});

test("ratio rounds to one decimal place", () => {
  const result = computeBybStandings({
    currentWeek: [{ userId: "a", name: "Alice", rawPoints: 100 }],
    historyByUser: new Map([["a", history([3, 3, 3])]]),
  });
  assert.equal(result.standings[0].ratio, 3333.3);
});

test("empty competition yields empty standings with zero top score", () => {
  const result = computeBybStandings({ currentWeek: [], historyByUser: new Map() });
  assert.deepEqual(result.standings, []);
  assert.equal(result.topRawPoints, 0);
});

test("players without history entries are treated as first-timers", () => {
  const result = computeBybStandings({
    currentWeek: [{ userId: "a", name: "Alice", rawPoints: 80 }],
    historyByUser: new Map(),
  });
  assert.equal(result.standings[0].ranked, false);
  assert.equal(result.standings[0].rawPoints, 80);
});

test("constants match the agreed spec", () => {
  assert.equal(BYB_HISTORY_WINDOW, 8);
  assert.equal(BYB_MIN_PRIOR_COMPETITIONS, 3);
});

test("primary pod is the one with the most points", () => {
  const pointsByPod = new Map([["pod-b", 10], ["pod-a", 30], ["pod-c", 20]]);
  assert.equal(resolveBybPrimaryPod(pointsByPod), "pod-a");
});

test("primary pod ties break on lexicographic pod id", () => {
  const pointsByPod = new Map([["pod-b", 10], ["pod-a", 10]]);
  assert.equal(resolveBybPrimaryPod(pointsByPod), "pod-a");
  assert.equal(resolveBybPrimaryPod(new Map()), null);
});

function championStandings() {
  return computeBybStandings({
    currentWeek: [
      { userId: "alice", name: "Alice", rawPoints: 100 },
      { userId: "bob", name: "Bob", rawPoints: 60 },
      { userId: "carol", name: "Carol", rawPoints: 40 },
    ],
    historyByUser: new Map([
      ["alice", history([100, 100, 100])],
      ["bob", history([80, 80, 80])],
      ["carol", history([50, 50, 50])],
    ]),
  });
}

const podNamesById = new Map([
  ["pod-1", "Alpha"],
  ["pod-2", "Beta"],
]);

test("one champion per pod from qualified players only", () => {
  // Top raw = 100, floor = 50: Alice (100) and Bob (60) qualify, Carol (40) does not.
  const result = championStandings();
  const champions = selectBybPodChampions({
    standings: result.standings,
    podTotals: [
      { podId: "pod-1", userId: "alice", points: 100 },
      { podId: "pod-2", userId: "bob", points: 40 },
      { podId: "pod-2", userId: "carol", points: 20 },
    ],
    podNamesById,
  });
  assert.deepEqual(
    champions.map((champion) => [champion.podName, champion.name]),
    [["Alpha", "Alice"], ["Beta", "Bob"]],
  );
});

test("pods without a qualified player produce no champion", () => {
  const result = championStandings();
  const champions = selectBybPodChampions({
    standings: result.standings,
    podTotals: [
      { podId: "pod-1", userId: "alice", points: 100 },
      { podId: "pod-2", userId: "carol", points: 40 },
    ],
    podNamesById,
  });
  assert.equal(champions.length, 1);
  assert.equal(champions[0].podName, "Alpha");
});

test("multi-pod agents are attributed to their highest-scoring pod", () => {
  const result = championStandings();
  const champions = selectBybPodChampions({
    standings: result.standings,
    podTotals: [
      { podId: "pod-1", userId: "alice", points: 30 },
      { podId: "pod-2", userId: "alice", points: 70 },
      { podId: "pod-2", userId: "bob", points: 60 },
    ],
    podNamesById,
  });
  // Alice's primary pod is pod-2, so Beta's champion is Alice (higher ratio than Bob).
  assert.deepEqual(champions.map((champion) => champion.name), ["Alice"]);
  assert.equal(champions[0].podName, "Beta");
});

test("champions are ordered by pod name and unknown pods are ignored", () => {
  const result = championStandings();
  const champions = selectBybPodChampions({
    standings: result.standings,
    podTotals: [
      { podId: "pod-2", userId: "bob", points: 60 },
      { podId: "pod-ghost", userId: "carol", points: 40 },
      { podId: "pod-1", userId: "alice", points: 100 },
    ],
    podNamesById,
  });
  assert.deepEqual(champions.map((champion) => champion.podName), ["Alpha", "Beta"]);
});
