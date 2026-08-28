import prisma from '@db/prisma';
import { normalizeUserId } from '@utils/normalizeUserId';
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';

/**
 * Sending to Expo's push service.
 *
 * One client for the process: it holds a connection pool and rate-limit state, so building
 * a new one per send would throw both away. No access token is configured — that is only
 * required once "enhanced security" is switched on for the Expo project, and doing it
 * silently here would make every send fail the moment somebody turns it on without also
 * setting `EXPO_ACCESS_TOKEN`.
 */
const accessToken = process.env.EXPO_ACCESS_TOKEN;
// Spread rather than `accessToken: undefined` — `exactOptionalPropertyTypes` treats an
// explicit undefined as a different thing from an absent key, and the SDK's option is not
// declared to accept it.
const expo = new Expo({ ...(accessToken ? { accessToken } : {}) });

/** What a caller wants delivered, before it is fanned out across a user's devices. */
export type PushPayload = {
	title: string;
	body: string;
	/** Read by the client's tap handler to decide where to land. */
	data?: Record<string, string>;
};

/**
 * How long to wait before asking Expo what actually happened.
 *
 * A ticket only says Expo *queued* the message. The delivery verdict lands in a **receipt**
 * some time later, which is why a send can report success while nothing ever arrives —
 * `BadDeviceToken` and the rest are only visible here. Expo's guidance is roughly fifteen
 * minutes before the receipt exists.
 */
const RECEIPT_DELAY_MS = 15 * 60 * 1000;

/** A message Expo accepted, paired with the device it was meant for. */
type SentTicket = { ticketId: string; token: string };

/**
 * Tokens Expo rejected as belonging to an uninstalled or reset app.
 *
 * Pruning matters more than it looks: a stale token is not an error the user ever sees, but
 * it is retried on every future send, and a device that reinstalls picks up a new token
 * while the old one lingers forever. `DeviceNotRegistered` is the only error that means
 * "stop trying" — the rest are transient, or ours to fix and nothing to do with the device.
 */
const removeDeadTokens = async (tokens: string[]): Promise<void> => {
	if (tokens.length === 0) {
		return;
	}

	await prisma.pushToken.deleteMany({ where: { token: { in: tokens } } });
};

/**
 * Asks Expo how the messages it accepted actually fared, and prunes what died.
 *
 * Exported so it can be tested and, if a scheduler ever exists, driven by one. It has to be
 * a second round trip because a ticket is not a delivery: a send that reported success can
 * still have been refused by APNs, and without this that failure is invisible — no error, no
 * log, nothing arriving.
 *
 * Only `DeviceNotRegistered` prunes. `BadDeviceToken` looks similar and is not: it means the
 * *build* is wrong — an app without push entitlements, or a token from the other APNs
 * environment — so the token is a symptom and deleting it would fix nothing while quietly
 * emptying the table for every user on that build.
 */
export const checkPushReceipts = async (sent: SentTicket[]): Promise<void> => {
	if (sent.length === 0) {
		return;
	}

	try {
		const tokenByTicketId = new Map(sent.map(entry => [entry.ticketId, entry.token]));
		const dead: string[] = [];

		for (const chunk of expo.chunkPushNotificationReceiptIds([...tokenByTicketId.keys()])) {
			const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

			for (const [ticketId, receipt] of Object.entries(receipts)) {
				if (receipt.status !== 'error') {
					continue;
				}

				// Logged whatever the reason: this is the only place a delivery failure is
				// visible at all, and silence here is what made a broken build look healthy.
				console.error(`Push receipt error (${receipt.details?.error ?? 'unknown'}): ${receipt.message}`);

				const token = tokenByTicketId.get(ticketId);

				if (receipt.details?.error === 'DeviceNotRegistered' && token) {
					dead.push(token);
				}
			}
		}

		await removeDeadTokens(dead);
	} catch (error) {
		console.error('Push receipt check failed', error);
	}
};

/**
 * Sends a notification to every device a user has registered.
 *
 * **Never throws.** Callers reach this from inside domain flows — joining a group, closing a
 * round — where a push is a courtesy and the write is the point. An unreachable Expo, an
 * expired token or a malformed message must not fail the thing the user actually asked for,
 * so everything here is caught and logged.
 *
 * Returns the number of messages Expo accepted, which is what the tests assert on.
 */
export const sendPushToUser = async (userId: string, payload: PushPayload): Promise<number> => {
	try {
		const rows = await prisma.pushToken.findMany({
			where: { userId: normalizeUserId(userId) },
			select: { token: true }
		});

		// A token that isn't Expo's shape can only have come from a bad client build; it would
		// be rejected per-message anyway, and filtering here keeps the chunks clean.
		const tokens = rows.map(row => row.token).filter(token => Expo.isExpoPushToken(token));

		if (tokens.length === 0) {
			return 0;
		}

		const messages: ExpoPushMessage[] = tokens.map(token => ({
			to: token,
			sound: 'default',
			title: payload.title,
			body: payload.body,
			...(payload.data ? { data: payload.data } : {})
		}));

		const tickets: ExpoPushTicket[] = [];
		const dead: string[] = [];

		// Expo caps how many messages go in one request; the SDK does the splitting.
		for (const chunk of expo.chunkPushNotifications(messages)) {
			try {
				tickets.push(...(await expo.sendPushNotificationsAsync(chunk)));
			} catch (error) {
				console.error('Push chunk failed', error);
			}
		}

		/*
		 * A ticket is only an acknowledgement that Expo took the message. Delivery errors
		 * arrive later as receipts — but `DeviceNotRegistered` is reported on the ticket too,
		 * and that is the one worth acting on immediately, since it names a token we should
		 * never send to again.
		 */
		const sent: SentTicket[] = [];

		tickets.forEach((ticket, index) => {
			const token = tokens[index];

			if (!token) {
				return;
			}

			if (ticket.status === 'error') {
				if (ticket.details?.error === 'DeviceNotRegistered') {
					dead.push(token);
				}

				return;
			}

			sent.push({ ticketId: ticket.id, token });
		});

		await removeDeadTokens(dead);

		/*
		 * The second round trip, later. Scheduled rather than awaited because the receipt does
		 * not exist yet — asking now would always come back empty — and `unref` so a pending
		 * timer can never hold the process open on shutdown.
		 *
		 * This is best effort: a restart in the meantime loses the check. That is the honest
		 * trade for having no scheduler, and it is still the difference between a delivery
		 * failure being logged and it being invisible, which is how a whole afternoon of sends
		 * looked successful while nothing arrived.
		 */
		if (sent.length > 0) {
			setTimeout(() => void checkPushReceipts(sent), RECEIPT_DELAY_MS).unref();
		}

		return tickets.filter(ticket => ticket.status === 'ok').length;
	} catch (error) {
		console.error('Push send failed', error);

		return 0;
	}
};
