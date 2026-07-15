import assert from "node:assert/strict";
import test from "node:test";
import { pageParams, pagedResult } from "./http-pagination";

test("pagination defaults and bounds untrusted query values", () => {
  assert.deepEqual(pageParams(new URLSearchParams()), { limit: 100, offset: 0, take: 101 });
  assert.deepEqual(pageParams(new URLSearchParams("limit=9999&offset=-3")), {
    limit: 500,
    offset: 0,
    take: 501,
  });
  assert.deepEqual(pageParams(new URLSearchParams("limit=bad&offset=20"), { defaultLimit: 25 }), {
    limit: 25,
    offset: 20,
    take: 26,
  });
});

test("paged results expose continuation metadata without changing item shape", () => {
  assert.deepEqual(pagedResult([1, 2, 3], 2, 4), {
    items: [1, 2],
    pagination: { limit: 2, offset: 4, hasMore: true, nextOffset: 6 },
  });
  assert.deepEqual(pagedResult([1], 2, 0), {
    items: [1],
    pagination: { limit: 2, offset: 0, hasMore: false, nextOffset: null },
  });
});
