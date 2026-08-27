import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UseFormWatch } from 'react-hook-form';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

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

	useEffect(() => {
		// `watch`'s callback form only fires on subsequent changes, never for the initial
		// mount — so unlike a value-diffing effect, this can't accidentally write back the
		// values a screen was just loaded with.
		const subscription = watch((values, { name }) => {
			if (name === 'reminderTime' && values.reminderTime) {
				const nextReminderTime = values.reminderTime;

				if (writeTimeoutRef.current) {
					clearTimeout(writeTimeoutRef.current);
				}

				writeTimeoutRef.current = setTimeout(() => {
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

			if (writeTimeoutRef.current) {
				clearTimeout(writeTimeoutRef.current);
			}
		};
	}, [onRemindersEnabled, updateSettings, watch]);

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

	const remindersSchema = useMemo(() => createRemindersSchema(), []);

	useEffect(() => {
		Notifications.getPermissionsAsync()
			.then(result => setHasNotifPermission(result.status === 'granted'))
			.catch(() => setHasNotifPermission(true));
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

	const firstGroup = groups?.[0];
	const unreadCount = firstGroup ? firstGroup.myBabNumbers.length - firstGroup.myReadCount : 0;

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
								{isTimePickerVisible ? (
									<View style={styles.pickerWrap}>
										<DateTimePicker
											display={Platform.OS === 'ios' ? 'spinner' : 'default'}
											mode='time'
											onChange={handleTimeChange}
											value={toDate(time)}
										/>
										{Platform.OS === 'ios' ? (
											<Pressable
												onPress={() => setIsTimePickerVisible(false)}
												style={styles.pickerDone}
											>
												<BodyStrongText color={theme.colors.accent}>{t('done')}</BodyStrongText>
											</Pressable>
										) : null}
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
			{firstGroup ? (
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
							<BodyStrongText>{t('notifTitle', { group: firstGroup.name })}</BodyStrongText>
							<CaptionText color={theme.colors.subtext} style={styles.previewBody}>
								{t('notifBody', { unread: unreadCount, read: firstGroup.readCount })}
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
