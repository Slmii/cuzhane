import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ProfileSkeleton } from './ProfileSkeleton.component';
import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
import { ActivityHeatmap } from '@/components/ui/ActivityHeatmap/ActivityHeatmap.component';
import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Divider } from '@/components/ui/Divider/Divider.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Form } from '@/components/ui/Form/Form.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl.component';
import { StatTile } from '@/components/ui/StatTile/StatTile.component';
import { BodyStrongText, MonoText } from '@/components/ui/Typography/Typography.component';
import { useDeleteAccount } from '@/lib/hooks/useAccount';
import { useGetProfileStats } from '@/lib/hooks/useProfileStats';
import { useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { AppLanguage } from '@/lib/i18n/strings';
import { createProfileSchema, ProfileForm } from '@/lib/schemas/profile.schema';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { ThemeMode } from '@/lib/theme/tokens';
import { DeleteAccountSheet } from '@/screens/Profile/DeleteAccountSheet.component';
import { FeedbackSheet } from '@/screens/Profile/FeedbackSheet.component';
import { InlineFieldRow } from '@/screens/Profile/InlineFieldRow.component';
import { PhotoSheet } from '@/screens/Profile/PhotoSheet.component';
import { useAuth, useUser } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { File } from 'expo-file-system';
import { useCallback, useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

export const ProfileScreen = () => {
	const { mode, setMode, theme } = useThemeContext();
	const { language, setLanguage, t } = useTranslation();
	const { data: stats, isError, isPending, refetch } = useGetProfileStats();
	const updateSettings = useUpdateUserSettings();
	const deleteAccount = useDeleteAccount();
	const { user } = useUser();
	const { signOut } = useAuth();
	const queryClient = useQueryClient();

	const [isPhotoSheetOpen, setIsPhotoSheetOpen] = useState(false);
	const [isFeedbackSheetOpen, setIsFeedbackSheetOpen] = useState(false);
	const [isDeleteSheetOpen, setIsDeleteSheetOpen] = useState(false);
	const [isDeletingAccount, setIsDeletingAccount] = useState(false);

	const profileSchema = useMemo(() => createProfileSchema(t), [t]);

	const handleLanguageChange = useCallback(
		(value: string) => {
			const nextLanguage = value as AppLanguage;
			setLanguage(nextLanguage);
			updateSettings.mutate({ language: nextLanguage });
		},
		[setLanguage, updateSettings]
	);

	const handleAppearanceChange = useCallback(
		(value: string) => {
			setMode(value as ThemeMode);
		},
		[setMode]
	);

	const handleSignOut = useCallback(async () => {
		await signOut();
		// Every cached query was fetched as the person signing out. Without this the next
		// account to sign in on this device renders their groups and stats for a beat,
		// because TanStack serves the stale entry before the refetch lands.
		queryClient.clear();
	}, [queryClient, signOut]);

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

	if (isPending) {
		return (
			<ScreenContainer shouldIncludeTabBarOffset>
				<ProfileSkeleton />
			</ScreenContainer>
		);
	}

	if (isError || !stats) {
		return (
			<ScreenContainer shouldIncludeTabBarOffset>
				<EmptyState actionLabel={t('retry')} onAction={refetch} title={t('genericError')} />
			</ScreenContainer>
		);
	}

	const memberSinceDate = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(
		new Date(stats.memberSince)
	);
	const hasPhoto = !!user?.hasImage;
	const version = Constants.expoConfig?.version;
	const buildNumber =
		Platform.OS === 'ios'
			? Constants.expoConfig?.ios?.buildNumber
			: Platform.OS === 'android'
			? Constants.expoConfig?.android?.versionCode
			: undefined;
	const appVersion = version ? (buildNumber ? `${version} (${buildNumber})` : version) : '—';

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

						if (field === 'firstName') {
							if (nextValue !== (user.firstName ?? '')) {
								user.update({ firstName: nextValue }).catch(() => {});
							}
							return;
						}

						if (nextValue !== (user.lastName ?? '')) {
							user.update({ lastName: nextValue }).catch(() => {});
						}
					};

					return (
						<>
							<ScreenTitle
								description={t('memberSince', { date: memberSinceDate })}
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
							<CardSurface isFlush style={styles.nameCard}>
								<Controller
									control={control}
									name='firstName'
									render={({ field }) => (
										<InlineFieldRow
											autoCapitalize='words'
											label={t('firstName')}
											onBlur={() => {
												field.onBlur();
												persistIfChanged('firstName');
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
												persistIfChanged('lastName');
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
			<View style={styles.statsRow}>
				<StatTile label={t('babsRead')} style={styles.statTile} tone='accent' value={stats.babsRead} />
				<StatTile label={t('roundsDone')} style={styles.statTile} tone='accent' value={stats.roundsCompleted} />
				<StatTile label={t('streak')} style={styles.statTile} tone='accent' value={stats.streakDays} />
			</View>
			<CardSurface style={styles.heatmapCard}>
				<BodyStrongText style={styles.heatmapTitle}>{t('last30')}</BodyStrongText>
				<ActivityHeatmap columns={15} days={stats.last30Days} />
			</CardSurface>
			<CardSurface isFlush style={styles.settingsCard}>
				<View style={styles.settingsRow}>
					<BodyStrongText>{t('language')}</BodyStrongText>
					<SegmentedControl
						onChange={handleLanguageChange}
						options={[
							{ label: 'Türkçe', value: 'tr' },
							{ label: 'English', value: 'en' }
						]}
						value={language}
					/>
				</View>
				<Divider />
				<View style={styles.settingsRow}>
					<BodyStrongText>{t('appearance')}</BodyStrongText>
					<SegmentedControl
						onChange={handleAppearanceChange}
						options={[
							{ label: t('light'), value: 'light' },
							{ label: t('dark'), value: 'dark' }
						]}
						value={mode}
					/>
				</View>
				<Divider />
				{/*
				 * The support surface, and the only row here that leaves the screen. It reads
				 * as a destination rather than a setting — label, where it goes, chevron —
				 * which is what separates it from the two controls above it.
				 */}
				<Pressable
					accessibilityRole='button'
					onPress={() => setIsFeedbackSheetOpen(true)}
					style={({ pressed }) => [styles.settingsRow, { opacity: pressed ? 0.6 : 1 }]}
				>
					<BodyStrongText>{t('feedback')}</BodyStrongText>
					<View style={styles.settingsNav}>
						<Icon color={theme.colors.subtext} name='chevron' size={14} strokeWidth={1.8} />
					</View>
				</Pressable>
				<Divider />
				<View style={styles.settingsRow}>
					<BodyStrongText>{t('appVersion')}</BodyStrongText>
					<MonoText color={theme.colors.subtext}>{appVersion}</MonoText>
				</View>
			</CardSurface>
			<View style={styles.footer}>
				<AppButton onPress={handleSignOut} title={t('signOut')} variant='surface' />
				<Pressable
					accessibilityRole='button'
					onPress={() => setIsDeleteSheetOpen(true)}
					style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.6 : 1 }]}
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
			<DeleteAccountSheet
				isDeleting={isDeletingAccount}
				isVisible={isDeleteSheetOpen}
				onClose={() => setIsDeleteSheetOpen(false)}
				onConfirm={handleDeleteAccountConfirm}
			/>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
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
	heatmapCard: {
		marginBottom: 14
	},
	heatmapTitle: {
		marginBottom: 12
	},
	nameCard: {
		marginBottom: 14
	},
	settingsCard: {
		marginBottom: 14
	},
	settingsNav: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 7
	},
	settingsRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		padding: 15
	},
	statTile: {
		flex: 1
	},
	statsRow: {
		flexDirection: 'row',
		gap: 8,
		marginBottom: 14
	}
});
