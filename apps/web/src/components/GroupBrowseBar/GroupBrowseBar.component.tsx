import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Divider } from '@/components/ui/Divider/Divider.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyStrongText, CaptionText, EyebrowText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { appFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { CYCLE_FILTER_OPTIONS, GROUP_SORT_OPTIONS, isGroupSortActive } from '@/lib/utils/groupBrowse';
import { cycleLabelKey } from '@/lib/utils/groups';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { GroupBrowseBarProps } from './GroupBrowseBar.types';

/**
 * Search, filter and sort over a list of groups — the same control in Keşfet and Gruplarım.
 *
 * It exists as one component because the two screens ask the same three questions of the
 * same shape of data. Written twice they would drift: a "Boş kontenjan" that meant one
 * thing on one screen and another elsewhere is the same word doing two jobs.
 *
 * State lives with the caller, not here. Each screen already owns how its list is fetched
 * — Keşfet sends the cadence to the server, Gruplarım holds the whole shelf — so the bar
 * reports changes and lets the screen decide what to do with them.
 *
 * **`hasControls` drops the filter and sort buttons, leaving the search field.** Both screens
 * carry those two in the navigator's bar instead, as one pull-down (`GroupBrowseMenu`); the
 * search box cannot follow them there, because a menu holds no text field. So both pass `false`
 * today and the bar is, in practice, the search field — the two sheets below are still what the
 * `true` path renders, and nothing renders it. Kept rather than deleted: the sheets are the only
 * form of these controls that works without a native menu, and a screen may yet want them inline.
 */
export const GroupBrowseBar = ({ hasControls = true, onChange, state }: GroupBrowseBarProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	const [isFilterOpen, setIsFilterOpen] = useState(false);
	const [isSortOpen, setIsSortOpen] = useState(false);

	// The search box is excluded: it shows what it is doing, so a dot on the filter button
	// would be claiming credit for a narrowing the reader can already see.
	const isFilterActive = state.cycle !== undefined || state.isNotStartedOnly || state.hasSeatsOnly;
	const isSortActive = isGroupSortActive(state);

	const statusRows = [
		{
			isOn: state.isNotStartedOnly,
			label: t('fNotStarted'),
			onToggle: () => onChange({ ...state, isNotStartedOnly: !state.isNotStartedOnly }),
			sub: t('fNotStartedSub')
		},
		{
			isOn: state.hasSeatsOnly,
			label: t('fSeats'),
			onToggle: () => onChange({ ...state, hasSeatsOnly: !state.hasSeatsOnly }),
			sub: t('fSeatsSub')
		}
	];

	return (
		<>
			<View style={styles.searchRow}>
				<View
					style={[
						styles.searchField,
						{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
					]}
				>
					<Icon color={theme.colors.faintText} name='search' size={15} strokeWidth={1.7} />
					<TextInput
						onChangeText={search => onChange({ ...state, search })}
						placeholder={t('searchGroups')}
						placeholderTextColor={theme.colors.faintText}
						style={[styles.searchInput, { color: theme.colors.text, fontFamily: appFonts.regular }]}
						value={state.search}
					/>
				</View>
				{!hasControls ? null : (
					<>
						<Pressable
							accessibilityLabel={t('filterTitle')}
							accessibilityRole='button'
							onPress={() => setIsFilterOpen(true)}
							style={({ pressed }) => [
								styles.iconButton,
								{
									backgroundColor: isFilterActive ? theme.colors.accentSoft : theme.colors.surface,
									borderColor: isFilterActive ? theme.colors.accent : theme.colors.border,
									opacity: pressed ? 0.7 : 1
								}
							]}
						>
							<Icon
								color={isFilterActive ? theme.colors.accent : theme.colors.subtext}
								name='filter'
								size={20}
								strokeWidth={1.6}
							/>
							{isFilterActive ? (
								<View style={[styles.activeDot, { backgroundColor: theme.colors.accent }]} />
							) : null}
						</Pressable>
						{/* Its own control, not a row inside the filter sheet: narrowing and ordering
				    are different questions, and folding the second into the first hides it. */}
						<Pressable
							accessibilityLabel={t('sortTitle')}
							accessibilityRole='button'
							onPress={() => setIsSortOpen(true)}
							style={({ pressed }) => [
								styles.iconButton,
								{
									backgroundColor: isSortActive ? theme.colors.accentSoft : theme.colors.surface,
									borderColor: isSortActive ? theme.colors.accent : theme.colors.border,
									opacity: pressed ? 0.7 : 1
								}
							]}
						>
							<Icon
								color={isSortActive ? theme.colors.accent : theme.colors.subtext}
								name='sort'
								size={20}
								strokeWidth={1.6}
							/>
							{isSortActive ? (
								<View style={[styles.activeDot, { backgroundColor: theme.colors.accent }]} />
							) : null}
						</Pressable>
					</>
				)}
			</View>

			<AppBottomSheet isVisible={isFilterOpen} onClose={() => setIsFilterOpen(false)} title={t('filterTitle')}>
				<EyebrowText color={theme.colors.faintText} style={styles.eyebrow}>
					{t('filterCadence')}
				</EyebrowText>
				<View style={styles.card}>
					{CYCLE_FILTER_OPTIONS.map((option, index) => {
						const isSelected = state.cycle === option;

						return (
							<View key={option ?? 'all'}>
								{index > 0 ? <Divider /> : null}
								<Pressable
									accessibilityRole='radio'
									accessibilityState={{ selected: isSelected }}
									// Picking doesn't dismiss. The sheet holds two sections and an
									// Uygula, so closing on the first tap would take Durum away
									// before it had been answered.
									onPress={() => onChange({ ...state, cycle: option })}
									style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
								>
									<BodyStrongText>
										{option ? t(cycleLabelKey(option)) : t('allGroups')}
									</BodyStrongText>
									<View
										style={[
											styles.ring,
											{
												borderColor: isSelected
													? theme.colors.accent
													: theme.colors.borderStrong
											}
										]}
									>
										<View
											style={[
												styles.ringDot,
												{
													backgroundColor: isSelected
														? theme.colors.accent
														: theme.colors.transparent
												}
											]}
										/>
									</View>
								</Pressable>
							</View>
						);
					})}
				</View>

				{/*
				 * Durum: two independent conditions, so checkboxes rather than the radio ring
				 * above. Neither closes the sheet — you may well want both, and a sheet that
				 * shuts on the first tap makes the second one a second trip.
				 */}
				<EyebrowText color={theme.colors.faintText} style={styles.eyebrow}>
					{t('filterStatus')}
				</EyebrowText>
				<View style={styles.card}>
					{statusRows.map((statusRow, index) => (
						<View key={statusRow.label}>
							{index > 0 ? <Divider /> : null}
							<Pressable
								accessibilityRole='checkbox'
								accessibilityState={{ checked: statusRow.isOn }}
								onPress={statusRow.onToggle}
								style={({ pressed }) => [styles.statusRow, { opacity: pressed ? 0.7 : 1 }]}
							>
								<View style={styles.statusCopy}>
									<BodyStrongText>{statusRow.label}</BodyStrongText>
									<CaptionText color={theme.colors.subtext}>{statusRow.sub}</CaptionText>
								</View>
								<View
									style={[
										styles.checkbox,
										{
											backgroundColor: statusRow.isOn
												? theme.colors.accent
												: theme.colors.transparent,
											borderColor: statusRow.isOn
												? theme.colors.accent
												: theme.colors.borderStrong
										}
									]}
								>
									{statusRow.isOn ? (
										<Icon color={theme.colors.onAccent} name='check' size={12} strokeWidth={2.6} />
									) : null}
								</View>
							</Pressable>
						</View>
					))}
				</View>

				<AppButton onPress={() => setIsFilterOpen(false)} title={t('filterApply')} />
			</AppBottomSheet>

			<AppBottomSheet isVisible={isSortOpen} onClose={() => setIsSortOpen(false)} title={t('sortTitle')}>
				<View style={styles.card}>
					{GROUP_SORT_OPTIONS.map((option, index) => {
						const isSelected = state.sortKey === option.key;

						return (
							<View key={option.key}>
								{index > 0 ? <Divider /> : null}
								<Pressable
									accessibilityRole='radio'
									accessibilityState={{ selected: isSelected }}
									// One choice, no Apply — so picking it *is* the confirmation.
									onPress={() => {
										onChange({ ...state, sortKey: option.key });
										setIsSortOpen(false);
									}}
									style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
								>
									<BodyStrongText>{t(option.labelKey)}</BodyStrongText>
									<View
										style={[
											styles.ring,
											{
												borderColor: isSelected
													? theme.colors.accent
													: theme.colors.borderStrong
											}
										]}
									>
										<View
											style={[
												styles.ringDot,
												{
													backgroundColor: isSelected
														? theme.colors.accent
														: theme.colors.transparent
												}
											]}
										/>
									</View>
								</Pressable>
							</View>
						);
					})}
				</View>
			</AppBottomSheet>
		</>
	);
};

const styles = StyleSheet.create({
	activeDot: {
		borderRadius: 3,
		height: 6,
		position: 'absolute',
		right: 9,
		top: 9,
		width: 6
	},
	// 16 under every card, 9 under every eyebrow — so a section reads as a heading bound to
	// the card beneath it, and "Uygula" sits clear of the last one rather than against it.
	card: {
		marginBottom: 16
	},
	checkbox: {
		alignItems: 'center',
		borderRadius: 6,
		borderWidth: 1.5,
		height: 20,
		justifyContent: 'center',
		width: 20
	},
	eyebrow: {
		marginBottom: 9
	},
	iconButton: {
		alignItems: 'center',
		borderRadius: 13,
		borderWidth: StyleSheet.hairlineWidth,
		flex: 0,
		justifyContent: 'center',
		width: 46
	},
	ring: {
		alignItems: 'center',
		borderRadius: 9,
		borderWidth: 1.5,
		height: 18,
		justifyContent: 'center',
		width: 18
	},
	ringDot: {
		borderRadius: 4,
		height: 8,
		width: 8
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		padding: 15
	},
	searchField: {
		alignItems: 'center',
		borderRadius: 13,
		borderWidth: StyleSheet.hairlineWidth,
		flex: 1,
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 14,
		paddingVertical: 12
	},
	searchInput: {
		flex: 1,
		fontSize: 13,
		padding: 0
	},
	searchRow: {
		alignItems: 'stretch',
		flexDirection: 'row',
		gap: 9,
		marginBottom: 16
	},
	statusCopy: {
		flex: 1,
		gap: 3,
		minWidth: 0
	},
	statusRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 15,
		paddingVertical: 14
	}
});
