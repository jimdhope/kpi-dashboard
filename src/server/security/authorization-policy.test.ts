import assert from "node:assert/strict";
import test from "node:test";
import {
  getApiPermissionRequirement,
  getPagePermissionRequirement,
} from "./authorization-policy";

test("view pages and their management pages require the expected levels", () => {
  assert.deepEqual(getPagePermissionRequirement("/performance"), {
    resource: "performance",
    minLevel: "VIEW",
  });
  assert.deepEqual(getPagePermissionRequirement("/performance/log"), {
    resource: "performance",
    minLevel: "MANAGE",
  });
  assert.deepEqual(getPagePermissionRequirement("/knowledge-base/example/edit"), {
    resource: "knowledgeBase",
    minLevel: "MANAGE",
  });
  assert.deepEqual(getPagePermissionRequirement("/directory/contacts/123/edit"), {
    resource: "directory",
    minLevel: "MANAGE",
  });
  assert.deepEqual(getPagePermissionRequirement("/settings/general"), {
    resource: "settings",
    minLevel: "MANAGE",
  });
  assert.equal(getPagePermissionRequirement("/dashboard"), null);
});

test("read and write methods receive the correct API permission level", () => {
  assert.deepEqual(getApiPermissionRequirement("/api/reports", "GET"), {
    resource: "reports",
    minLevel: "VIEW",
  });
  assert.deepEqual(getApiPermissionRequirement("/api/reports", "POST"), {
    resource: "reports",
    minLevel: "MANAGE",
  });
  assert.deepEqual(getApiPermissionRequirement("/api/competitions/active", "HEAD"), {
    resource: "competitions",
    minLevel: "VIEW",
  });
  assert.deepEqual(getApiPermissionRequirement("/api/competitions", "DELETE"), {
    resource: "competitions",
    minLevel: "MANAGE",
  });
});

test("self-service APIs retain view-level mutation access", () => {
  assert.deepEqual(getApiPermissionRequirement("/api/performance/kpi-logs", "POST"), {
    resource: "performance",
    minLevel: "VIEW",
  });
  assert.deepEqual(getApiPermissionRequirement("/api/mini-games/daily-word", "POST"), {
    resource: "miniGames",
    minLevel: "VIEW",
  });
  assert.deepEqual(getApiPermissionRequirement("/api/kb/articles/article-id/comments", "POST"), {
    resource: "knowledgeBase",
    minLevel: "VIEW",
  });
});

test("specific knowledge-base comment rules win over article management rules", () => {
  assert.deepEqual(getApiPermissionRequirement("/api/kb/articles/article-id/comments/1", "PATCH"), {
    resource: "knowledgeBase",
    minLevel: "VIEW",
  });
  assert.deepEqual(getApiPermissionRequirement("/api/kb/articles/article-id", "PATCH"), {
    resource: "knowledgeBase",
    minLevel: "MANAGE",
  });
  assert.equal(getApiPermissionRequirement("/api/auth/session", "GET"), null);
});
