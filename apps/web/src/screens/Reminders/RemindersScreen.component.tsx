import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Collapsible } from '@/components/ui/Collapsible/Collapsible.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Form } from '@/components/ui/Form/Form.component';
import { FormToggleRow } from '@/components/ui/Form/ToggleRow/ToggleRow.component';
import {
	BodyStrongText,
	CaptionText,
	FieldLabelText,
	Typography
} from '@/components/ui/Typography/Typography.component';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { createRemindersSchema, RemindersForm } from '@/lib/schemas/profile.schema';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { registerDeviceForPush } from '@/lib/utils/notifications/pushRegistration';
import { isNextReminderTomorrow } from '@/lib/utils/reminder';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useIsFocused } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UseFormWatch } from 'react-hook-form';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { RemindersSkeleton } from './RemindersSkeleton.component';

const REMINDER_TIME_WRITE_DELAY_MS = 600;

const pad = (value: number) => String(value).padStart(2, '0');

const parseTime = (reminderTime: string) => {
	const [hour, minute] = reminderTime.split(':').map(Number);
	return { hour: hour || 0, minute: minute || 0 };
};

const formatTime = (time: { hour: number; minute: number }) => `${pad(time.hour)}:${pad(time.minute)}`;

const toDate = (time: { hour: number; minute: number }) => {
	const date = new Date();
	date.setHours(time.hour, time.minute, 0, 0);

	return date;
};

type ReminderPersistenceProps = {
	updateSettings: ReturnType<typeof useUpdateUserSettings>;
	watch: UseFormWatch<RemindersForm>;
	/**
	 * Fired when the reader switches either notification on, to ask the OS for permission.
	 *
	 * Both switches need it, and for different reasons: the daily reminder is scheduled on the
	 * device and the group one is delivered from the server, and neither arrives without the
	 * permission — nor without a registered push token, which is why this also registers one.
	 */
	onNotificationsEnabled: () => void;
};

/**
 * Non-visual: mirrors form changes to the server as they happen. The time write is
 * debounced so holding a stepper doesn't fire a request per tap; toggles persist right away.
 */
/**
 * The switches on this screen, in the order they are drawn. Adding one here is what makes it
 * persist — see the callback below.
 */
const SWITCH_FIELDS = [
	'reminderEnabled',
	'cevsenGroupReadsEnabled',
	'cevsenRoundCompleteEnabled',
	'cevsenPoolClaimEnabled',
	'hatimGroupReadsEnabled',
	'hatimRoundCompleteEnabled',
	'hatimPoolClaimEnabled',
	'memberJoinedEnabled',
	'memberLeftEnabled'
] as const satisfies readonly (keyof RemindersForm)[];

const ReminderPersistence = ({ onNotificationsEnabled, updateSettings, watch }: ReminderPersistenceProps) => {
	const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	/** The value a pending debounce is holding, so it can be forced out early. */
	const pendingTimeRef = useRef<string | null>(null);

	const flushPendingTime = useCallback(() => {
		if (writeTimeoutRef.current) {
			clearTimeout(writeTimeoutRef.current);
			writeTimeoutRef.current = null;
		}

		if (pendingTimeRef.current !== null) {
			updateSettings.mutate({ reminderTime: pendingTimeRef.current });
			pendingTimeRef.current = null;
		}
	}, [updateSettings]);

	/**
	 * A debounce lives in a JS timer, and a timer dies with the process. Someone who picked
	 * a new time and immediately swiped the app away lost it — the server kept the old
	 * value, and the next cold start scheduled the old time and reverted the picker. Leaving
	 * the foreground is the last moment we are certain to get, so the write goes out there.
	 */
	useEffect(() => {
		const subscription = AppState.addEventListener('change', state => {
			if (state !== 'active') {
				flushPendingTime();
			}
		});

		return () => subscription.remove();
	}, [flushPendingTime]);

	useEffect(() => {
		// `watch`'s callback form only fires on subsequent changes, never for the initial
		// mount — so unlike a value-diffing effect, this can't accidentally write back the
		// values a screen was just loaded with.
		const subscription = watch((values, { name }) => {
			if (name === 'reminderTime' && values.reminderTime) {
				const nextReminderTime = values.reminderTime;

				pendingTimeRef.current = nextReminderTime;

				if (writeTimeoutRef.current) {
					clearTimeout(writeTimeoutRef.current);
				}

				writeTimeoutRef.current = setTimeout(() => {
					writeTimeoutRef.current = null;
					pendingTimeRef.current = null;
					updateSettings.mutate({ reminderTime: nextReminderTime });
				}, REMINDER_TIME_WRITE_DELAY_MS);
				return;
			}

			/*
			 * **Every switch, from one list.** Each used to have a branch of its own, identical
			 * but for the field name — so the three added with the pool and membership events
			 * simply had none, flipped on screen, wrote nothing, and reverted on the next mount.
			 * A screen whose switches are a list cannot grow one that persists by accident.
			 */
			const toggle = SWITCH_FIELDS.find(field => field === name);

			if (toggle !== undefined) {
				const isOn = values[toggle];

				if (isOn === undefined) {
					return;
				}

				updateSettings.mutate({ [toggle]: isOn });

				// Every one of them needs the OS permission, and a registered token with it: the
				// daily reminder is scheduled on the device, the other five arrive from the server.
				if (isOn) {
					onNotificationsEnabled();
				}
			}
		});

		return () => {
			subscription.unsubscribe();
			// Leaving the screen is also a last chance: send the pending time rather than
			// dropping it with the timer.
			flushPendingTime();
		};
	}, [flushPendingTime, onNotificationsEnabled, updateSettings, watch]);

	return null;
};

export const RemindersScreen = () => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const settingsQuery = useGetUserSettings();
	const { data: settings, isError, isPending } = settingsQuery;
	const updateSettings = useUpdateUserSettings();

	const [hasNotifPermission, setHasNotifPermission] = useState(true);
	const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
	/**
	 * Only ever read to say whether the chosen time still lies ahead today. Refreshed at the
	 * three moments the answer can have changed — picking a time, returning to the
	 * foreground, and coming back to this tab — rather than ticking, which would rerender
	 * the screen every second to move a line that changes once a day.
	 */
	const [now, setNow] = useState(() => new Date());
	const isFocused = useIsFocused();
	const [wasFocused, setWasFocused] = useState(isFocused);

	// Adjusting state during render, rather than in an effect: switching tabs doesn't touch
	// AppState, so without this the line kept claiming "bugün 09:52" at 09:54.
	if (isFocused !== wasFocused) {
		setWasFocused(isFocused);

		if (isFocused) {
			setNow(new Date());
		}
	}

	const remindersSchema = useMemo(() => createRemindersSchema(), []);

	/**
	 * Re-read on every return to the foreground, not only on mount. Granting or revoking
	 * happens in the device's own Settings, so the app is always in the background when it
	 * changes — checked once, this screen would keep showing the "no permission" hint to
	 * someone who had just granted it, or hide it from someone who had just revoked it.
	 */
	useEffect(() => {
		const readPermission = () => {
			Notifications.getPermissionsAsync()
				.then(result => setHasNotifPermission(result.status === 'granted'))
				.catch(() => setHasNotifPermission(true));
		};

		readPermission();

		const subscription = AppState.addEventListener('change', state => {
			if (state === 'active') {
				readPermission();
				setNow(new Date());
			}
		});

		return () => subscription.remove();
	}, []);

	// Asking only when a notification is switched on keeps the prompt tied to the moment it
	// makes sense. iOS only ever shows the system dialog once; after that this resolves
	// to the standing answer, and the hint below points at Settings.
	const requestNotifPermission = useCallback(async () => {
		try {
			const current = await Notifications.getPermissionsAsync();
			const isGranted =
				current.status === 'granted' || (await Notifications.requestPermissionsAsync()).status === 'granted';

			setHasNotifPermission(isGranted);

			/*
			 * **The token is registered here, not left to the next launch.** The group-reads
			 * notification is a server push, so it needs a row in `PushToken` — and
			 * `usePushTokenRegistration` only registers a device that *already* has permission,
			 * which a device granting it this second does not. Home's prompt registers at the
			 * same moment for the same reason. Best effort: the switch is saved either way.
			 */
			if (isGranted) {
				await registerDeviceForPush();
			}
		} catch {
			// Leave the hint as-is if the platform refuses to answer.
		}
	}, []);

	if (isPending) {
		return (
			<ScreenContainer shouldIncludeTabBarOffset>
				<ScreenHeader hasBackButton title={t('reminders')} />
				<RemindersSkeleton />
			</ScreenContainer>
		);
	}

	if (isError || !settings) {
		return <ErrorState queries={[settingsQuery]} />;
	}

	return (
		<ScreenContainer shouldIncludeTabBarOffset>
			<ScreenHeader hasBackButton title={t('reminders')} />
			<Form<RemindersForm>
				isFullHeight={false}
				defaultValues={{
					reminderTime: settings.reminderTime,
					reminderEnabled: settings.reminderEnabled,
					cevsenGroupReadsEnabled: settings.cevsenGroupReadsEnabled,
					cevsenRoundCompleteEnabled: settings.cevsenRoundCompleteEnabled,
					cevsenPoolClaimEnabled: settings.cevsenPoolClaimEnabled,
					hatimGroupReadsEnabled: settings.hatimGroupReadsEnabled,
					hatimRoundCompleteEnabled: settings.hatimRoundCompleteEnabled,
					hatimPoolClaimEnabled: settings.hatimPoolClaimEnabled,
					memberJoinedEnabled: settings.memberJoinedEnabled,
					memberLeftEnabled: settings.memberLeftEnabled
				}}
				render={({ setValue, watch }) => {
					const time = parseTime(watch('reminderTime'));
					const reminderTime = formatTime(time);
					// Only claimed when something will actually arrive: switched off, or with
					// permission refused, naming a delivery time would be a straight lie.
					const hasNextReminder = watch('reminderEnabled') && hasNotifPermission;
					const nextReminderHint = isNextReminderTomorrow(reminderTime, now)
						? t('nextReminderTomorrow', { time: reminderTime })
						: t('nextReminderToday', { time: reminderTime });

					// Android's picker is a dialog that closes itself; iOS keeps the spinner
					// inline until the reader dismisses it.
					const handleTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
						if (Platform.OS === 'android') {
							setIsTimePickerVisible(false);
						}

						if (event.type !== 'dismissed' && selectedDate) {
							setValue(
								'reminderTime',
								formatTime({ hour: selectedDate.getHours(), minute: selectedDate.getMinutes() })
							);
							// This picks between "today" and "tomorrow", so it has to be answered
							// against the clock as it is now, not as it was when the screen mounted.
							setNow(new Date());
						}
					};

					return (
						<>
							<ReminderPersistence
								onNotificationsEnabled={() => void requestNotifPermission()}
								updateSettings={updateSettings}
								watch={watch}
							/>
							<View style={styles.sections}>
								{/*
								 * **The clock collapses with the switch.** A time is meaningless
								 * while nothing is scheduled, so it leaves rather than sitting
								 * there inert. `Collapsible` animates the block's own height and
								 * the card follows, because the block is what takes up the room —
								 * a layout transition on the card instead left the clock popping
								 * in and out inside a surface that was still resizing.
								 */}
								{/*
								 * **Three sections: Genel, Kuran, Cevşen.** Three of the five group notifications are
								 * not one event but two — "someone finished their share" is a range of babs in one kind
								 * and a cüz in the other — so each has a switch per kind, under the heading for that
								 * kind. Who joins or leaves is the same event either way and stays shared.
								 *
								 * One card a section rather than one card a switch: at six cards the screen was a stack
								 * with nothing saying which notification belonged to what.
								 */}
								<FieldLabelText style={styles.sectionLabel}>{t('notifGeneral')}</FieldLabelText>
								<CardSurface isFlush>
									<FormToggleRow
										hint={t('memberJoinedAlertHint')}
										name='memberJoinedEnabled'
										title={t('memberJoinedAlert')}
									/>
									<View style={[styles.stackedRow, { borderTopColor: theme.colors.divider }]}>
										<FormToggleRow
											hint={t('memberLeftAlertHint')}
											name='memberLeftEnabled'
											title={t('memberLeftAlert')}
										/>
									</View>
								</CardSurface>

								<FieldLabelText style={styles.sectionLabel}>{t('qHatim')}</FieldLabelText>
								<CardSurface isFlush>
									<FormToggleRow
										hint={t('groupReadsHintCuz')}
										name='hatimGroupReadsEnabled'
										title={t('groupReads')}
									/>
									<View style={[styles.stackedRow, { borderTopColor: theme.colors.divider }]}>
										<FormToggleRow
											hint={t('roundCompleteAlertHintCuz')}
											name='hatimRoundCompleteEnabled'
											title={t('roundCompleteAlert')}
										/>
									</View>
									<View style={[styles.stackedRow, { borderTopColor: theme.colors.divider }]}>
										<FormToggleRow
											hint={t('poolClaimAlertHintCuz')}
											name='hatimPoolClaimEnabled'
											title={t('poolClaimAlertCuz')}
										/>
									</View>
								</CardSurface>

								<FieldLabelText style={styles.sectionLabel}>{t('qCevsen')}</FieldLabelText>
								<CardSurface isFlush>
									{/*
									 * **The daily reminder is Cevşen's.** `reminderTotals` counts only Cevşen
									 * groups — a hatim round runs ten or thirty days, so a nightly "you still owe"
									 * would nag about something not due — which is why it sits under this heading
									 * rather than above the sections as a screen-wide setting.
									 *
									 * **The clock collapses with the switch.** A time is meaningless while nothing
									 * is scheduled, so it leaves rather than sitting there inert. `Collapsible`
									 * animates the block's own height and the card follows, because the block is
									 * what takes up the room — a layout transition on the card instead left the
									 * clock popping in and out inside a surface that was still resizing.
									 */}
									<FormToggleRow
										hint={t('dailyReminderHint')}
										name='reminderEnabled'
										title={t('dailyReminder')}
									/>
									<Collapsible isOpen={watch('reminderEnabled')}>
										<View style={[styles.timeBlock, { borderTopColor: theme.colors.divider }]}>
											<FieldLabelText color={theme.colors.faintText} textAlign='center'>
												{t('dailyAt')}
											</FieldLabelText>
											<Pressable
												accessibilityRole='button'
												onPress={() => setIsTimePickerVisible(current => !current)}
												style={({ pressed }) => [
													styles.timeRow,
													{ opacity: pressed ? 0.7 : 1 }
												]}
											>
												<Typography style={styles.timeValue} variant='display'>
													{pad(time.hour)}:{pad(time.minute)}
												</Typography>
											</Pressable>
											{hasNextReminder ? (
												<CaptionText color={theme.colors.faintText} style={styles.nextReminder}>
													{nextReminderHint}
												</CaptionText>
											) : null}
											{isTimePickerVisible ? (
												<View style={styles.pickerWrap}>
													<DateTimePicker
														display={Platform.OS === 'ios' ? 'spinner' : 'default'}
														mode='time'
														onChange={handleTimeChange}
														value={toDate(time)}
													/>
													{/*
													 * Closes the picker; it does not save. The value is written on every
													 * turn of the spinner and debounced, so leaving without tapping this
													 * keeps the time either way.
													 */}
													<Pressable
														onPress={() => setIsTimePickerVisible(false)}
														style={styles.pickerDone}
													>
														<BodyStrongText color={theme.colors.accent}>
															{t('confirm')}
														</BodyStrongText>
													</Pressable>
												</View>
											) : null}
										</View>
									</Collapsible>
									<View style={[styles.stackedRow, { borderTopColor: theme.colors.divider }]}>
										<FormToggleRow
											hint={t('groupReadsHint')}
											name='cevsenGroupReadsEnabled'
											title={t('groupReads')}
										/>
									</View>
									<View style={[styles.stackedRow, { borderTopColor: theme.colors.divider }]}>
										<FormToggleRow
											hint={t('roundCompleteAlertHint')}
											name='cevsenRoundCompleteEnabled'
											title={t('roundCompleteAlert')}
										/>
									</View>
									<View style={[styles.stackedRow, { borderTopColor: theme.colors.divider }]}>
										<FormToggleRow
											hint={t('poolClaimAlertHint')}
											name='cevsenPoolClaimEnabled'
											title={t('poolClaimAlert')}
										/>
									</View>
								</CardSurface>
							</View>
						</>
					);
				}}
				schema={remindersSchema}
			/>
			{hasNotifPermission ? null : (
				<CaptionText color={theme.colors.subtext}>{t('notifPermissionHint')}</CaptionText>
			)}
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	// The gap the cards had from `ScreenContainer` before they were wrapped for the tour.
	sections: {
		gap: 12
	},
	/** The heading above each section's card — the same field label the forms use. */
	sectionLabel: {
		marginBottom: -4,
		marginTop: 6
	},
	/** A row stacked under another inside one card: the hairline is what separates them. */
	stackedRow: {
		borderTopWidth: StyleSheet.hairlineWidth
	},
	centerFill: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center'
	},
	previewBody: {
		marginTop: 3
	},
	previewCard: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 12
	},
	previewIcon: {
		alignItems: 'center',
		borderRadius: 9,
		height: 30,
		justifyContent: 'center',
		width: 30
	},
	previewTextColumn: {
		flex: 1
	},
	nextReminder: {
		marginTop: 2
	},
	pickerDone: {
		alignItems: 'center',
		paddingVertical: 10
	},
	pickerWrap: {
		marginTop: 4
	},
	timeBlock: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		padding: 15
	},
	timeRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 14,
		justifyContent: 'center'
	},
	timeValue: {
		fontSize: 46,
		letterSpacing: -0.46,
		lineHeight: 50
	}
});
