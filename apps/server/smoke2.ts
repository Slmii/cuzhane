// TEMPORARY check for the Home screen's bulk read-all path. Deleted after use.
import prisma from '@db/prisma';
import { createGroupForUser, deleteGroupForUser } from '@services/groups.service';
import { joinGroupForUser } from '@services/groupMembership.service';
import { listBabsForUser, setAssignedBabsReadForUser, setBabReadForUser } from '@services/babs.service';

const OWNER = 'user_owner_smoke2';
const B = 'user_b_smoke2';

let failures = 0;

const check = (label: string, ok: boolean, detail = '') => {
	if (ok) {
		console.log(`  PASS  ${label}`);
	} else {
		failures += 1;
		console.log(`  FAIL  ${label} ${detail}`);
	}
};

const run = async () => {
	const group = await createGroupForUser(OWNER, 'Owner', {
		name: 'Home Smoke',
		visibility: 'OPEN',
		splitMode: 'FIXED',
		cycle: 'WEEKLY',
		spots: 20,
		reminderEnabled: true,
		reminderTime: '21:30'
	});
	await joinGroupForUser(B, 'Bee', group.id);

	console.log('\n[1] read-all marks only the caller’s share');
	await setAssignedBabsReadForUser(B, group.id, true);
	let babs = await listBabsForUser(OWNER, group.id);
	const bRead = babs.filter(x => x.readByUserId === B).map(x => x.number);
	const ownerRead = babs.filter(x => x.readByUserId === OWNER).length;
	check('joiner’s 6–10 all read', JSON.stringify(bRead) === JSON.stringify([6, 7, 8, 9, 10]), `(got ${bRead})`);
	check('owner’s babs untouched', ownerRead === 0, `(${ownerRead} read)`);

	console.log('\n[2] read-all does not re-stamp an already-read bab');
	const before = (await listBabsForUser(B, group.id)).find(x => x.number === 6)?.readAt;
	await new Promise(r => setTimeout(r, 25));
	await setAssignedBabsReadForUser(B, group.id, true);
	const after = (await listBabsForUser(B, group.id)).find(x => x.number === 6)?.readAt;
	check('readAt preserved', before === after, `(${before} vs ${after})`);

	console.log('\n[3] read-all can clear the whole share');
	await setAssignedBabsReadForUser(B, group.id, false);
	babs = await listBabsForUser(B, group.id);
	check('joiner has nothing read', babs.filter(x => x.readByUserId === B).length === 0);

	console.log('\n[4] completedAt stamps at 100 and clears on unmark');
	// 20 seats, but only two are filled — assign every bab to the owner to finish the round.
	await prisma.groupBab.updateMany({ where: { groupId: group.id }, data: { assignedUserId: OWNER } });
	await setAssignedBabsReadForUser(OWNER, group.id, true);
	let row = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
	check('completedAt stamped', row.completedAt !== null);

	await setBabReadForUser(OWNER, group.id, 42, false);
	row = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
	check('completedAt cleared on unmark', row.completedAt === null);

	console.log('\n[5] non-member cannot bulk-read');
	try {
		await setAssignedBabsReadForUser('user_outsider', group.id, true);
		failures += 1;
		console.log('  FAIL  outsider read-all resolved (expected 404)');
	} catch (error) {
		check('outsider read-all -> 404', (error as { statusCode?: number }).statusCode === 404);
	}

	await deleteGroupForUser(OWNER, group.id);
	console.log(failures === 0 ? '\nALL CHECKS PASSED\n' : `\n${failures} CHECK(S) FAILED\n`);
	await prisma.$disconnect();
	process.exit(failures === 0 ? 0 : 1);
};

run().catch(async error => {
	console.error('THREW:', error);
	await prisma.$disconnect();
	process.exit(1);
});
