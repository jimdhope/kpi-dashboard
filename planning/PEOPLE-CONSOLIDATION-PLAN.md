# People consolidation plan

## Goal

Make **Settings → People** the single place to view and manage people,
campaigns, pods, memberships, roles, and absences. The existing Campaigns,
Pods, and Users pages will remain in place until their replacements have been
tested in day-to-day use.

## Non-negotiable safeguards

- Do not remove or redirect an existing page until its replacement is live and
  accepted by administrators.
- Preserve all existing data and permissions. This is an interface
  consolidation, not a data migration.
- Keep server-side permission checks on every existing and new mutation.
- Add features in small releases; validate each against restored live-like data.

## Capability checklist

| Existing area | Current capability | People replacement | Status |
| --- | --- | --- | --- |
| Users | List/search accounts | Searchable people directory | Done |
| Users | Create/edit account, roles, password reset, delete, preview | Person detail drawer/page with account actions | Planned |
| Pods | List/create/edit/delete pods | Pods tab/section with the same actions | Planned |
| Pods | Assign campaign, leader, manager, Teams webhooks | Pod detail editor | Planned |
| Pods | Manage membership | Person membership editor and pod membership view | Planned |
| Campaigns | List/create/edit/delete campaigns | Campaigns tab/section with the same actions | Planned |
| Absences | Record/review date ranges and unknown end dates | Person timeline plus absence editor | Planned |
| Permissions | Role permission configuration | Remains separate initially | Retained |

## Delivery order

### 1. Person detail and account actions

- Select a person from the People directory.
- Show profile, roles, pod membership, current and historic absences.
- Move safe account actions from Users: create, edit roles/name, password reset,
  preview, and delete (with the existing protections).
- Keep `/settings/users` available as the fallback during rollout.

**Acceptance check:** an admin can complete every current Users-page task from
People without changing permission behaviour.

**Progress (2026-07-18):** Selecting a person now opens a detail panel with
their account details, roles, pod memberships, and absence history. Admins can
edit name/roles there, while authorised managers can set a temporary password
under the same existing server-side rules. Admins can also create accounts,
open the existing read-only user preview, and delete accounts from People with
the same server-side protections as the Users page.

### 2. Membership and pod management

- Add a Pods section to People.
- Reuse the current pod editor fields and membership rules.
- Let an authorised manager add/remove a person from only the pods they are
  allowed to manage.
- Keep `/settings/pods` as the fallback.

**Acceptance check:** pod membership, leaders, managers, campaigns, and Teams
configuration work identically from People and Pods.

**Progress (2026-07-18):** People now lists pods and provides an authorised pod
editor for name, description, campaign, team leader, pod manager, and incoming
and outgoing Teams webhooks. Membership can be changed from the person detail
panel. Admins can now also delete a pod from People only after an explicit
confirmation; the existing server-side dependency safeguards remain in force.

### 3. Campaign management

- Add a Campaigns section to People.
- Reuse the current create/edit/delete behaviour.
- Show linked pods and the people count for each campaign.
- Keep `/settings/campaigns` as the fallback.

**Acceptance check:** a campaign manager can complete all current campaign
tasks without using the old page.

**Progress (2026-07-18):** People now shows campaigns with linked-pod counts.
Admins can create and edit campaign names and descriptions there. The legacy
Campaigns page remains available while the remaining campaign fields and
retirement checks are completed.

### 4. Absence workflow in context

- Add an absence editor and absence history to the person detail.
- Keep the current dedicated absence page until the new workflow is accepted.
- Preserve date-overlap and present-override behaviour in competition logging.

**Acceptance check:** a manager can create, review, and correct an absence from
the person record; daily score logging continues to reflect it correctly.

**Progress (2026-07-18):** Managers can now record an absence from a person's
detail panel, with an optional reason and an unknown end date. Existing absence
history is visible there. Selecting a history item now allows authorised
managers to correct its dates/reason or remove an incorrect record. The
dedicated Absences page remains the fallback for reviewing the complete list
during the parallel run.

### 5. Parallel-run acceptance

- Run the old and People workflows in parallel with real local/restored data.
- Confirm every listed capability and role boundary.
- Confirm manager scoping, especially around pod membership and password reset.
- Only then replace old navigation entries with links/redirects to People.

## Retirement rule

The old Users, Pods, and Campaigns pages are not removed merely because a new
screen exists. They are retired only after the capability checklist is complete,
the affected managers approve the replacement, and a rollback path has been
recorded.
