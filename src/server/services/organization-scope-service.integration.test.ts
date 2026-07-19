import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "@/server/db/client";
import { getManagedPodIds, requireManagedPod, requireManagedUser } from "./organization-scope-service";

test("team leaders can manage all assigned pods but not unrelated pods or users", async (t) => {
  const fixture = randomUUID();
  const leaderId = `scope-leader-${fixture}`;
  const managedUserId = `scope-agent-${fixture}`;
  const unrelatedUserId = `scope-unrelated-agent-${fixture}`;
  const managedPodIds = [`scope-pod-a-${fixture}`, `scope-pod-b-${fixture}`];
  const unrelatedPodId = `scope-pod-c-${fixture}`;

  t.after(async () => {
    await prisma.podMembership.deleteMany({ where: { podId: { in: [...managedPodIds, unrelatedPodId] } } });
    await prisma.pod.deleteMany({ where: { id: { in: [...managedPodIds, unrelatedPodId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [leaderId, managedUserId, unrelatedUserId] } } });
  });

  await prisma.user.createMany({ data: [
    { id: leaderId, email: `${leaderId}@example.invalid`, name: "Scope leader" },
    { id: managedUserId, email: `${managedUserId}@example.invalid`, name: "Managed agent" },
    { id: unrelatedUserId, email: `${unrelatedUserId}@example.invalid`, name: "Unrelated agent" },
  ] });
  await prisma.pod.createMany({ data: [
    { id: managedPodIds[0], name: "Managed pod A", teamLeaderId: leaderId },
    { id: managedPodIds[1], name: "Managed pod B", teamLeaderId: leaderId },
    { id: unrelatedPodId, name: "Unrelated pod" },
  ] });
  await prisma.podMembership.createMany({ data: [
    { podId: managedPodIds[0], userId: managedUserId },
    { podId: unrelatedPodId, userId: unrelatedUserId },
  ] });

  const leader = { id: leaderId, roles: ["teamLeader"] };
  assert.deepEqual(new Set(await getManagedPodIds(leader, "people")), new Set(managedPodIds));
  await requireManagedPod(leader, managedPodIds[0], "people");
  await requireManagedPod(leader, managedPodIds[1], "competitions");
  await requireManagedUser(leader, managedUserId);
  await assert.rejects(requireManagedPod(leader, unrelatedPodId, "people"), /Forbidden/);
  await assert.rejects(requireManagedUser(leader, unrelatedUserId), /Forbidden/);
});

test("default global-scope permissions are not restricted to assigned pods", async () => {
  for (const role of ["admin", "campaignManager", "competitionRunner"]) {
    assert.equal(await getManagedPodIds({ id: "not-used", roles: [role] }, "competitions"), null);
  }
});
