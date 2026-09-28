import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
import { TourTarget } from '@/components/Tour/TourTarget.component';
import { ActivityHeatmap } from '@/components/ui/ActivityHeatmap/ActivityHeatmap.component';
import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Divider } from '@/components/ui/Divider/Divider.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Form } from '@/components/ui/Form/Form.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import {
	isSegmentedControlNative,
	SegmentedControl
} from '@/components/ui/SegmentedControl/SegmentedControl.component';
import { StatTile } from '@/components/ui/StatTile/StatTile.component';
import { BodyStrongText, CaptionText, MonoText } from '@/components/ui/Typography/Typography.component';
import { useDeleteAccount } from '@/lib/hooks/useAccount';
import { useGetProfileStats } from '@/lib/hooks/useProfileStats';
import { LanguageSheet } from '@/screens/Profile/LanguageSheet.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { LANGUAGE_NATIVE_NAMES } from '@/lib/i18n/strings';
import { createProfileSchema, ProfileForm } from '@/lib/schemas/profile.schema';
import { appVersionLabel } from '@/lib/utils/appVersion';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { ThemeMode } from '@/lib/theme/tokens';
import { FeedbackSheet } from '@/screens/Profile/FeedbackSheet.component';
import { useTour } from '@/components/Tour/Tour.context';
import { InlineFieldRow } from '@/screens/Profile/InlineFieldRow.component';
import { PhotoSheet } from '@/screens/Profile/PhotoSheet.component';
import { WhatsNewSheet } from '@/screens/WhatsNew/WhatsNewSheet.component';
import type { TabStackParamList } from '@/navigation/types';
import { useAuth, useUser } from '@clerk/expo';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { refreshMyProfile } from '@/api/profile.api';
import { groupQueryKeys, notificationQueryKeys } from '@/lib/hooks/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { useCallback, useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { confirmDestructive } from '@/lib/utils/confirmDestructive';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { ProfileSkeleton } from './ProfileSkeleton.component';

export const ProfileScreen = () => {
	const navigation = useNavigation<NativeStackNavigationProp<TabStackParamList>>();
	const { mode, setMode, theme } = useThemeContext();
	const { language, t } = useTranslation();
	const { start: startTour } = useTour();
	const statsQuery = useGetProfileStats();
	const { data: stats, isError, isPending } = statsQuery;
	const deleteAccount = useDeleteAccount();
	const { user } = useUser();
	const { signOut } = useAuth();
	const queryClient = useQueryClient();

	const [isPhotoSheetOpen, setIsPhotoSheetOpen] = useState(false);
	const [isFeedbackSheetOpen, setIsFeedbackSheetOpen] = useState(false);
	const [isLanguageSheetOpen, setIsLanguageSheetOpen] = useState(false);
	const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
	const [isDeletingAccount, setIsDeletingAccount] = useState(false);

	const profileSchema = useMemo(() => createProfileSchema(t), [t]);

	const handleAppearanceChange = useCallback(
		(value: string) => {
			setMode(value as ThemeMode);
		},
		[setMode]
	);

	const handleSignOutConfirm = useCallback(async () => {
		await signOut();
		// Every cached query was fetched as the person signing out. Without this the next
		// account to sign in on this device renders their groups and stats for a beat,
		// because TanStack serves the stale entry before the refetch lands.
		queryClient.clear();
	}, [queryClient, signOut]);

	/**
	 * Signing out asks first, like the other three account actions on this screen.
	 *
	 * `isDestructive: false` — it ends a session and takes nothing with it, so the confirm button
	 * is the accent rather than the red that "Hesabı sil" directly below it wears. Two red
	 * buttons on one screen would make the milder of the two look like the graver one.
	 */
	const handleSignOut = useCallback(() => {
		confirmDestructive({
			cancelLabel: t('cancel'),
			confirmLabel: t('signOut'),
			isDestructive: false,
			message: t('signOutHint'),
			onConfirm: () => void handleSignOutConfirm(),
			title: t('signOut')
		});
	}, [handleSignOutConfirm, t]);

	const handlePhotoPicked = useCallback(
		async (uri: string) => {
			if (!user) {
				return;
			}

			try {
				const base64 = await new File(uri).base64();
				await user.setProfileImage({ file: `data:image/jpeg;base64,${base64}` });
				// Clerk answers the upload with the new image, but the `user` resource this
				// screen renders from is a cached copy — without the reload it keeps serving
				// the old `imageUrl` and the avatar never changes.
				await user.reload();
			} catch (error) {
				// The design has no error state for this: the sheet has already closed, so a
				// failure shows as the previous photo, unchanged. Logged so a silent no-op is
				// at least diagnosable.
				if (__DEV__) {
					console.warn('[profile] photo upload failed:', error);
				}
			}
		},
		[user]
	);

	const handlePhotoRemoved = useCallback(async () => {
		if (!user) {
			return;
		}

		try {
			await user.setProfileImage({ file: null });
			await user.reload();
		} catch (error) {
			if (__DEV__) {
				console.warn('[profile] photo removal failed:', error);
			}
		}
	}, [user]);

	const handleDeleteAccountConfirm = useCallback(async () => {
		if (!user) {
			return;
		}

		setIsDeletingAccount(true);

		try {
			// Purge server-side data first — deleting the Clerk user first would leave
			// the API call unauthenticated and strand the rows.
			await deleteAccount.mutateAsync();
			await user.delete();
		} catch {
			setIsDeletingAccount(false);
		}
	}, [deleteAccount, user]);

	/**
	 * The platform's own dialog, like leaving and deleting a group — the two other actions in
	 * the app that cannot be undone. A sheet is the app's surface for *choosing* something and
	 * is dismissed by a drag or a tap outside; deleting an account is a yes/no, and it should
	 * ask in the voice the OS uses for one so it doesn't read as another screen.
	 *
	 * `deleteAccountHint` says what is lost, so the destructive button repeats the title rather
	 * than adding a second question.
	 */
	const handleDeleteAccountPress = useCallback(() => {
		confirmDestructive({
			cancelLabel: t('cancel'),
			confirmLabel: t('deleteAccountConfirm'),
			message: t('deleteAccountHint'),
			onConfirm: handleDeleteAccountConfirm,
			title: t('deleteAccount')
		});
	}, [handleDeleteAccountConfirm, t]);

	if (isPending) {
		return (
			<ScreenContainer shouldIncludeTabBarOffset>
				<ProfileSkeleton />
			</ScreenContainer>
		);
	}

	if (isError || !stats) {
		return <ErrorState queries={[statsQuery]} />;
	}

	const memberSinceDate = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(
		new Date(stats.memberSince)
	);
	const hasPhoto = !!user?.hasImage;
	// One reading, shared with the release notes — see `appVersion`. Read separately here once,
	// which is how this row came to say 1.0.1 while the notes a row above said 1.0.2.
	const appVersion = appVersionLabel();

	return (
		<ScreenContainer shouldIncludeTabBarOffset>
			<Form<ProfileForm>
				isFullHeight={false}
				defaultValues={{ firstName: user?.firstName ?? '', lastName: user?.lastName ?? '' }}
				render={({ control, getValues, trigger, watch }) => {
					const firstName = watch('firstName');
					const lastName = watch('lastName');
					const fullName = `${firstName} ${lastName}`.trim();

					// There is no submit button here — the value is saved on blur — so the
					// schema has to be applied explicitly, otherwise clearing a name would
					// happily persist an empty one.
					const persistIfChanged = async (field: 'firstName' | 'lastName') => {
						if (!user || !(await trigger(field))) {
							return;
						}

						const nextValue = getValues(field);
						const current = field === 'firstName' ? user.firstName ?? '' : user.lastName ?? '';

						if (nextValue === current) {
							return;
						}

						/*
						 * **The name lives in Clerk, and every screen that prints it reads it
						 * from the server.** Members lists, round details and the pool all show
						 * whoever holds a bab by their *live* Clerk name — so changing it here
						 * and doing nothing else left the old one on every one of them, with
						 * nothing to refetch and no reason to.
						 *
						 * Two things have to give way, and one of them is not on this device:
						 * the server caches Clerk profiles for a minute, which is a good trade
						 * for everyone else's name and a bad one for your own a second after
						 * changing it. So the server is told to forget the caller first, and the
						 * queries are invalidated only once it has — invalidating first would
						 * refetch, hit the warm cache, and re-cache the old name for another
						 * minute.
						 *
						 * Failures are swallowed the way the update itself always was: a name
						 * that saved but did not propagate corrects itself within the minute.
						 */
						try {
							await user.update(
								field === 'firstName' ? { firstName: nextValue } : { lastName: nextValue }
							);
							await refreshMyProfile();
							await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
							await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.root() });
						} catch {
							// Swallowed as the update always was — nothing here is worth an error
							// screen, and a name that saved but did not propagate corrects itself
							// within the cache's own minute.
						}
					};

					return (
						<>
							<ScreenTitle
								description={t('memberSince', { date: memberSinceDate })}
								// Pushed from Ana sayfa since K2 took its tab: the platform's back chevron
								// sits above, and the title clears it.
								isUnderNavigationBar
								label={fullName}
								size='name'
								leading={
									<Pressable
										accessibilityRole='button'
										onPress={() => setIsPhotoSheetOpen(true)}
										style={({ pressed }) => [
											styles.avatarPressable,
											{ transform: [{ scale: pressed ? 0.96 : 1 }] }
										]}
									>
										{hasPhoto && user?.imageUrl ? (
											// Keyed on the URL: RN caches an `<Image>` by source, so a
											// replaced photo that reuses the host path would otherwise
											// keep painting the old bytes.
											<Image
												key={user.imageUrl}
												source={{ uri: user.imageUrl }}
												style={styles.avatarImage}
											/>
										) : (
											<Avatar name={fullName} size={60} tone='accent' />
										)}
										<View
											style={[
												styles.editBadge,
												{
													backgroundColor: theme.colors.primary,
													borderColor: theme.colors.background
												}
											]}
										>
											<Icon
												color={theme.colors.onPrimary}
												name='edit'
												size={11}
												strokeWidth={2}
											/>
										</View>
									</Pressable>
								}
							/>
							<CardSurface isFlush>
								<Controller
									control={control}
									name='firstName'
									render={({ field }) => (
										<InlineFieldRow
											autoCapitalize='words'
											label={t('firstName')}
											onBlur={() => {
												field.onBlur();
												void persistIfChanged('firstName');
											}}
											onChangeText={value => field.onChange(value)}
											value={field.value}
										/>
									)}
								/>
								<Divider />
								<Controller
									control={control}
									name='lastName'
									render={({ field }) => (
										<InlineFieldRow
											autoCapitalize='words'
											label={t('lastName')}
											onBlur={() => {
												field.onBlur();
												void persistIfChanged('lastName');
											}}
											onChangeText={value => field.onChange(value)}
											value={field.value}
										/>
									)}
								/>
							</CardSurface>
						</>
					);
				}}
				schema={profileSchema}
			/>
			{/*
			 * **No `hasGlassSurface` here any more — it is `CardSurface`'s default.** This screen
			 * was where the material was tried, opted into per card while the rest of the app
			 * stayed flat. It graduated: every section surface in the app is glass now, so saying
			 * it at each call site would only imply the others aren't.
			 */}
			{/* Stops 14 and 15 of the first-use tour — the last two. */}
			<TourTarget id='stats' style={styles.statsRow}>
				<StatTile label={t('babsRead')} style={styles.statTile} tone='accent' value={stats.babsRead} />
				<StatTile label={t('roundsDone')} style={styles.statTile} tone='accent' value={stats.roundsCompleted} />
				<StatTile label={t('streak')} style={styles.statTile} tone='accent' value={stats.streakDays} />
			</TourTarget>
			<TourTarget id='heatmap'>
				<CardSurface>
					<BodyStrongText style={styles.heatmapTitle}>{t('last30')}</BodyStrongText>
					<ActivityHeatmap columns={15} days={stats.last30Days} />
				</CardSurface>
			</TourTarget>
			<CardSurface isFlush>
				{/*
				 * G3 → G4: the language is a row that opens a list, not a control in the row. A
				 * segment per language was already stacking onto its own line at three and had
				 * nowhere to go at four; a row reads the current choice — in that language's own
				 * name, so it is legible whatever the interface is set to — and leaves the choosing
				 * to a sheet with room for it. Same shape as the Feedback row below: label, where
				 * it goes, chevron.
				 */}
				<Pressable
					accessibilityRole='button'
					onPress={() => setIsLanguageSheetOpen(true)}
					style={({ pressed }) => [styles.settingsRow, { opacity: pressed ? 0.7 : 1 }]}
				>
					<BodyStrongText>{t('language')}</BodyStrongText>
					<View style={styles.settingsNav}>
						<CaptionText color={theme.colors.subtext}>{LANGUAGE_NATIVE_NAMES[language]}</CaptionText>
						<Icon color={theme.colors.faintText} name='chevronRight' size={15} strokeWidth={1.8} />
					</View>
				</Pressable>
				<Divider />
				<View style={styles.settingsRow}>
					<BodyStrongText>{t('appearance')}</BodyStrongText>
					{/*
					 * **The control is given a width; it cannot find one itself.** `@expo/ui`
					 * hosts the native segmented control with `matchContents={{ vertical: true }}`
					 * — it reports its own height and inherits its width from the parent. The
					 * language row above is a column, so it inherits the card's full width and
					 * looks fine; this row is a flex row, where nothing constrains width, and the
					 * control collapsed to nothing at all.
					 *
					 * A fixed width rather than `flex: 1`: filling the row stretches the control to
					 * the card's edge, where the design has it hugging the right. There is no
					 * third option — the native control reports no intrinsic width, so something
					 * has to name one, and only the caller knows how much room the row has.
					 *
					 * No icons. Sun and moon were two thirds of an answer — "system" has no glyph
					 * in the set, and UIKit gives a segment an image *or* a title, never both, so
					 * the third option would have read as a word among pictures.
					 */}
					<SegmentedControl
						onChange={handleAppearanceChange}
						options={[
							{ label: t('light'), value: 'light' },
							{ label: t('dark'), value: 'dark' },
							{ label: t('systemAppearance'), value: 'system' }
						]}
						// Only the native control needs telling; the drawn one hugs its segments,
						// and a fixed width left empty track after the last option.
						{...(isSegmentedControlNative ? { style: styles.settingsRowControl } : {})}
						value={mode}
					/>
				</View>
				<Divider />
				{/*
				 * The support surface, and the only row here that leaves the screen. It reads
				 * as a destination rather than a setting — label, where it goes, chevron —
				 * which is what separates it from the two controls above it.
				 */}
				{/*
				 * Section O's own way back in, and it starts by leaving this screen. The first
				 * two stops point at Ana sayfa's next-up card and its Read button, so `useTourNavigation` unwinds to Ana sayfa on the welcome card — see
				 * `goToTourHome`. It was left where it stood at first, on the grounds that
				 * `TourTarget` withdraws its rectangle on **blur** so those stops would simply
				 * centre their cards over Profil rather than cut a hole at another screen's
				 * coordinates. True, and beside the point: three cards describing a screen that
				 * is not the one you are looking at is not a walkthrough.
				 */}
				<Pressable
					accessibilityRole='button'
					onPress={() => startTour({ isReplay: true })}
					style={({ pressed }) => [styles.settingsRow, { opacity: pressed ? 0.6 : 1 }]}
				>
					<View style={styles.settingsCopy}>
						<BodyStrongText>{t('tourReplay')}</BodyStrongText>
						<CaptionText color={theme.colors.subtext}>{t('tourReplaySub')}</CaptionText>
					</View>
					<View style={styles.settingsNav}>
						<Icon color={theme.colors.subtext} name='chevronRight' size={14} strokeWidth={1.8} />
					</View>
				</Pressable>
				<Divider />
				{/* The Hizb-ül Hakaik, read for its own sake — its table of contents is a screen of its own. */}
				<Pressable
					accessibilityRole='button'
					onPress={() => navigation.navigate('HizbSections')}
					style={({ pressed }) => [styles.settingsRow, { opacity: pressed ? 0.6 : 1 }]}
				>
					<View style={styles.settingsCopy}>
						<BodyStrongText>{t('hizbRow')}</BodyStrongText>
						<CaptionText color={theme.colors.subtext}>{t('hizbRowSub')}</CaptionText>
					</View>
					<View style={styles.settingsNav}>
						<Icon color={theme.colors.subtext} name='chevronRight' size={14} strokeWidth={1.8} />
					</View>
				</Pressable>
				<Divider />
				{/*
				 * **The second way to the reminder settings**, and the reason giving the bell
				 * tab to the inbox is affordable: P4 is otherwise only behind the gear on that
				 * tab, and the daily reminder is too load-bearing to sit behind one glyph.
				 * The design lists this row as an entry point of its own.
				 */}
				<Pressable
					accessibilityRole='button'
					onPress={() => navigation.navigate('Reminders')}
					style={({ pressed }) => [styles.settingsRow, { opacity: pressed ? 0.6 : 1 }]}
				>
					<View style={styles.settingsCopy}>
						<BodyStrongText>{t('notifSettingsRow')}</BodyStrongText>
						<CaptionText color={theme.colors.subtext}>{t('notifSettingsRowSub')}</CaptionText>
					</View>
					<View style={styles.settingsNav}>
						<Icon color={theme.colors.subtext} name='chevronRight' size={14} strokeWidth={1.8} />
					</View>
				</Pressable>
				<Divider />
				<Pressable
					accessibilityRole='button'
					onPress={() => setIsFeedbackSheetOpen(true)}
					style={({ pressed }) => [styles.settingsRow, { opacity: pressed ? 0.6 : 1 }]}
				>
					<BodyStrongText>{t('feedback')}</BodyStrongText>
					<View style={styles.settingsNav}>
						<Icon color={theme.colors.subtext} name='chevronRight' size={14} strokeWidth={1.8} />
					</View>
				</Pressable>
				<Divider />
				{/*
				 * **P1 on demand.** The sheet otherwise opens once per release and is gone; this
				 * is the way back to it. Above the version row rather than anywhere else,
				 * because the two are the same subject at two depths — what changed in *this*
				 * release, and the record of every release.
				 */}
				<Pressable
					accessibilityRole='button'
					onPress={() => setIsWhatsNewOpen(true)}
					style={({ pressed }) => [styles.settingsRow, { opacity: pressed ? 0.6 : 1 }]}
				>
					<View style={styles.settingsCopy}>
						<BodyStrongText>{t('whatsNewTitle')}</BodyStrongText>
						<CaptionText color={theme.colors.subtext}>{t('whatsNewSub')}</CaptionText>
					</View>
					<View style={styles.settingsNav}>
						<Icon color={theme.colors.subtext} name='chevronRight' size={14} strokeWidth={1.8} />
					</View>
				</Pressable>
				<Divider />
				{/*
				 * P3's way in, and the version row is it — the notes are *about* this number, so
				 * a second row naming them would say the same thing twice. It keeps the version
				 * on the right and gains a chevron, which is the same shape as the rows above.
				 */}
				<Pressable
					accessibilityRole='button'
					onPress={() => navigation.navigate('ReleaseNotes')}
					style={({ pressed }) => [styles.settingsRow, { opacity: pressed ? 0.6 : 1 }]}
				>
					<BodyStrongText>{t('appVersion')}</BodyStrongText>
					<View style={styles.settingsNav}>
						<MonoText color={theme.colors.subtext}>{appVersion}</MonoText>
						<Icon color={theme.colors.faintText} name='chevronRight' size={14} strokeWidth={1.8} />
					</View>
				</Pressable>
			</CardSurface>
			<View style={styles.footer}>
				<AppButton
					onPress={handleSignOut}
					title={t('signOut')}
					variant={theme.mode === 'light' ? 'surface' : 'accent'}
				/>
				<Pressable
					accessibilityRole='button'
					// The dialog is native and the delete is not instant, so the row goes quiet
					// while it runs rather than accepting a second tap behind the first.
					disabled={isDeletingAccount}
					onPress={handleDeleteAccountPress}
					style={({ pressed }) => [styles.deleteButton, { opacity: pressed || isDeletingAccount ? 0.6 : 1 }]}
				>
					<BodyStrongText color={theme.colors.danger}>{t('deleteAccount')}</BodyStrongText>
				</Pressable>
			</View>
			<PhotoSheet
				hasPhoto={hasPhoto}
				isVisible={isPhotoSheetOpen}
				onClose={() => setIsPhotoSheetOpen(false)}
				onPicked={handlePhotoPicked}
				onRemoved={handlePhotoRemoved}
			/>
			<FeedbackSheet
				appVersion={appVersion}
				isVisible={isFeedbackSheetOpen}
				locale={language}
				onClose={() => setIsFeedbackSheetOpen(false)}
				platform={Platform.OS}
			/>
			<LanguageSheet isVisible={isLanguageSheetOpen} onClose={() => setIsLanguageSheetOpen(false)} />
			<WhatsNewSheet
				isVisible={isWhatsNewOpen}
				onClose={() => setIsWhatsNewOpen(false)}
				onShowAll={() => {
					setIsWhatsNewOpen(false);
					navigation.navigate('ReleaseNotes');
				}}
			/>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	settingsCopy: {
		gap: 2
	},
	avatarImage: {
		borderRadius: 30,
		height: 60,
		width: 60
	},
	avatarPressable: {
		flex: 0
	},
	centerFill: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center'
	},
	deleteButton: {
		alignItems: 'center',
		paddingVertical: 10
	},
	editBadge: {
		alignItems: 'center',
		borderRadius: 11,
		borderWidth: 2,
		bottom: -2,
		height: 22,
		justifyContent: 'center',
		position: 'absolute',
		right: -2,
		width: 22
	},
	footer: {
		gap: 9,
		marginTop: 6
	},
	heatmapTitle: {
		marginBottom: 12
	},
	settingsNav: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 7
	},
	settingsRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 14,
		justifyContent: 'space-between',
		padding: 15
	},
	/*
	 * A fixed width, and it has to be one — see the note at the call site.
	 *
	 * 214 is the ceiling, not a preference: on a 375pt phone the card is 335 wide, its padding
	 * takes 30, the gap 14 and "Görünüm" about 72, which leaves 219 before the label starts
	 * being squeezed. Three segments have to live inside that. It was 168 with two options,
	 * sized to the drawn control's own width so both variants matched; there is no such slack
	 * left, so the two can differ slightly here.
	 */
	settingsRowControl: {
		width: 214
	},
	statTile: {
		flex: 1
	},
	statsRow: {
		flexDirection: 'row',
		gap: 8
	}
});
