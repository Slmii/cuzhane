import { isNextReminderTomorrow, reminderTotals } from '@/lib/utils/reminder';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
import { BrandMark } from '@/components/ui/BrandMark/BrandMark.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Form } from '@/components/ui/Form/Form.component';
import { FormToggleRow } from '@/components/ui/Form/ToggleRow/ToggleRow.component';
import {
	BodyStrongText,
	CaptionText,
	FieldLabelText,
	Typography
} from '@/components/ui/Typography/Typography.component';
import { useGetGroups } from '@/lib/hooks/useGroup';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { createRemindersSchema, RemindersForm } from '@/lib/schemas/profile.schema';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useIsFocused } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UseFormWatch } from 'react-hook-form';
import { ActivityIndicator, AppState, Platform, Pressable, StyleSheet, View } from 'react-native';

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
	/** Fired when the reader switches daily reminders on, to ask the OS for permission. */
	onRemindersEnabled: () => void;
};

/**
 * Non-visual: mirrors form changes to the server as they happen. The time write is
 * debounced so holding a stepper doesn't fire a request per tap; toggles persist right away.
 */
const ReminderPersistence = ({ onRemindersEnabled, updateSettings, watch }: ReminderPersistenceProps) => {
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

			if (name === 'reminderEnabled' && values.reminderEnabled !== undefined) {
				updateSettings.mutate({ reminderEnabled: values.reminderEnabled });

				if (values.reminderEnabled) {
					onRemindersEnabled();
				}

				return;
			}
		});

		return () => {
			subscription.unsubscribe();
			// Leaving the screen is also a last chance: send the pending time rather than
			// dropping it with the timer.
			flushPendingTime();
		};
	}, [flushPendingTime, onRemindersEnabled, updateSettings, watch]);

	return null;
};

export const RemindersScreen = () => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const { data: settings, isError, isPending, refetch } = useGetUserSettings();
	const updateSettings = useUpdateUserSettings();
	const { data: groups } = useGetGroups();

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

	// Asking only when reminders are switched on keeps the prompt tied to the moment it
	// makes sense. iOS only ever shows the system dialog once; after that this resolves
	// to the standing answer, and the hint below points at Settings.
	const requestNotifPermission = useCallback(async () => {
		try {
			const current = await Notifications.getPermissionsAsync();

			if (current.status === 'granted') {
				setHasNotifPermission(true);
				return;
			}

			const requested = await Notifications.requestPermissionsAsync();
			setHasNotifPermission(requested.status === 'granted');
		} catch {
			// Leave the hint as-is if the platform refuses to answer.
		}
	}, []);

	if (isPending) {
		return (
			<ScreenContainer shouldIncludeTabBarOffset>
				<View style={styles.centerFill}>
					<ActivityIndicator color={theme.colors.accent} />
				</View>
			</ScreenContainer>
		);
	}

	if (isError || !settings) {
		return (
			<ScreenContainer shouldIncludeTabBarOffset>
				<EmptyState actionLabel={t('retry')} onAction={refetch} title={t('genericError')} />
			</ScreenContainer>
		);
	}

	// The scheduler's own sum, through the same helper, so this preview is the notification
	// that will actually arrive rather than an illustration of one.
	const { participatingGroups, pendingGroups, unread: unreadCount } = reminderTotals(groups);

	return (
		<ScreenContainer shouldIncludeTabBarOffset>
			<ScreenTitle label={t('reminders')} />
			<Form<RemindersForm>
				isFullHeight={false}
				defaultValues={{
					reminderTime: settings.reminderTime,
					reminderEnabled: settings.reminderEnabled
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
								onRemindersEnabled={() => void requestNotifPermission()}
								updateSettings={updateSettings}
								watch={watch}
							/>
							<CardSurface style={styles.timeCard}>
								<FieldLabelText color={theme.colors.faintText} textAlign='center'>
									{t('dailyAt')}
								</FieldLabelText>
								<Pressable
									accessibilityRole='button'
									onPress={() => setIsTimePickerVisible(current => !current)}
									style={({ pressed }) => [styles.timeRow, { opacity: pressed ? 0.7 : 1 }]}
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
										 * Closes the picker; it does not save. The value is written
										 * on every turn of the spinner and debounced, so leaving
										 * without tapping this keeps the time either way.
										 */}
										<Pressable
											onPress={() => setIsTimePickerVisible(false)}
											style={styles.pickerDone}
										>
											<BodyStrongText color={theme.colors.accent}>{t('confirm')}</BodyStrongText>
										</Pressable>
									</View>
								) : null}
							</CardSurface>
							<CardSurface isFlush>
								<FormToggleRow
									hint={t('dailyReminderHint')}
									name='reminderEnabled'
									title={t('dailyReminder')}
								/>
							</CardSurface>
						</>
					);
				}}
				schema={remindersSchema}
			/>
			{hasNotifPermission ? null : (
				<CaptionText color={theme.colors.subtext}>{t('notifPermissionHint')}</CaptionText>
			)}
			{participatingGroups > 0 ? (
				<>
					<FieldLabelText color={theme.colors.faintText}>{t('preview')}</FieldLabelText>
					<CardSurface style={styles.previewCard}>
						<View style={[styles.previewIcon, { backgroundColor: theme.colors.accent }]}>
							<BrandMark
								color={theme.colors.onAccent}
								fadedColor={toAlphaColor(theme.colors.onAccent, 0.34)}
								size={18}
							/>
						</View>
						<View style={styles.previewTextColumn}>
							<BodyStrongText>{t('notifTitle')}</BodyStrongText>
							<CaptionText color={theme.colors.subtext} style={styles.previewBody}>
								{unreadCount === 0
									? t('notifBodyIdle')
									: pendingGroups > 1
									? t('notifBodyGroups', { groups: pendingGroups, unread: unreadCount })
									: t('notifBody', { unread: unreadCount })}
							</CaptionText>
						</View>
					</CardSurface>
				</>
			) : null}
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
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
	timeCard: {
		alignItems: 'center'
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
