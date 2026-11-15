-- A member without a name in Clerk used to be stored under their email address, which every
-- other member (and, for an owner, anyone previewing an open group) could then read. The code
-- no longer does that; this clears what it already wrote. "Member" is the app's own fallback.

UPDATE "GroupMember"
SET "displayName" = 'Member'
WHERE "displayName" LIKE '%@%';

-- Inbox rows keep a copy of the actor's name in their payload.
UPDATE "Notification"
SET "payload" = "payload"
	|| CASE WHEN "payload"->>'memberName' LIKE '%@%' THEN '{"memberName": "Member"}'::jsonb ELSE '{}'::jsonb END
	|| CASE WHEN "payload"->>'readerName' LIKE '%@%' THEN '{"readerName": "Member"}'::jsonb ELSE '{}'::jsonb END
	|| CASE WHEN "payload"->>'takerName' LIKE '%@%' THEN '{"takerName": "Member"}'::jsonb ELSE '{}'::jsonb END
WHERE "payload"->>'memberName' LIKE '%@%'
	OR "payload"->>'readerName' LIKE '%@%'
	OR "payload"->>'takerName' LIKE '%@%';
