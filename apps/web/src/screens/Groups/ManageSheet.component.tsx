import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Divider } from '@/components/ui/Divider/Divider.component';
import { Field } from '@/components/ui/Form/Field/Field.component';
import { Form } from '@/components/ui/Form/Form.component';
import { FormOptionGroup } from '@/components/ui/Form/OptionGroup/OptionGroup.component';
import { FormStepper } from '@/components/ui/Form/Stepper/Stepper.component';
import { FormToggleRow } from '@/components/ui/Form/ToggleRow/ToggleRow.component';
import { NavRow } from '@/components/ui/NavRow/NavRow.component';
import { ToggleRow } from '@/components/ui/ToggleRow/ToggleRow.component';
import { CaptionText, EyebrowText, FieldLabelText, Header2 } from '@/components/ui/Typography/Typography.component';
import { useDeleteGroup, useUpdateGroup } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { MembersList } from './MembersList.component';
import { ReaderSeersPicker } from './ReaderSeersPicker.component';
import { editGroupSchema, type EditGroupForm } from '@/lib/schemas/group.schema';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupDetail } from '@/lib/types/domain';
import { confirmDestructive } from '@/lib/utils/confirmDestructive';
import type { TabStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

type Props = {
	group: GroupDetail;
	isVisible: boolean;
	onClose: () => void;
};

/** Tall enough for the details form and the rows under it; the body scrolls inside it. */
const SHEET_HEIGHT_RATIO = 0.82;
type SubPage = 'seers' | 'members';

/** How far a page slides as it comes and goes, and how long it takes — the reader's page turn. */
const PAGE_OFFSET = 48;
const PAGE_TURN_MS = 260;

/**
 * One page of the sheet, in place or eased off to one side (`side`: -1 left, 1 right) and faded.
 * A CSS transition, on one flat style object as Reanimated needs; instant under Reduce Motion.
 */
const pageTurn = (isShown: boolean, side: -1 | 1, isReducedMotion: boolean) => ({
	bottom: 0,
	left: 0,
	position: 'absolute' as const,
	right: 0,
	top: 0,
	opacity: isShown ? 1 : 0,
	transform: [{ translateX: isShown ? 0 : side * PAGE_OFFSET }],
	transitionDuration: isReducedMotion ? 0 : PAGE_TURN_MS,
	transitionProperty: ['opacity', 'transform'],
	transitionTimingFunction: 'ease-out' as const
});

/** Days without a completed reading before a Hizb reader is removed: up to a year. */
const INACTIVITY_DAY_OPTIONS = Array.from({ length: 365 }, (_, index) => index + 1);

export const ManageSheet = ({ group, isVisible, onClose: close }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const navigation = useNavigation<NativeStackNavigationProp<TabStackParamList>>();

	const updateGroup = useUpdateGroup();
	const deleteGroup = useDeleteGroup();
	const schema = useMemo(() => editGroupSchema(t), [t]);

	/**
	 * "Sorumlular" and "Üyeler" open as pages in this same sheet, back arrow in the corner — sheets
	 * cannot stack on iOS. Every way out lands on Yönet itself again next time.
	 */
	const [page, setPage] = useState<'manage' | SubPage>('manage');
	const isSubPage = page !== 'manage';
	/**
	 * The page slid over Yönet, kept after "back" so it can slide away rather than vanish. Mounted
	 * one frame before it is shown, so its first frame is the off-screen one it slides in from.
	 */
	const [subPage, setSubPage] = useState<SubPage | null>(null);
	const isReducedMotion = useReducedMotion();
	const openPage = (next: SubPage) => {
		setSubPage(next);
		requestAnimationFrame(() => setPage(next));
	};
	const onClose = () => {
		setPage('manage');
		setSubPage(null);
		close();
	};
	// A shared Hizb plan: the only group with responsible members.
	const isSharedPlan = group.hizbPlan != null && !group.hizbIndividual;

	// Only a shared Hizb plan has the rule; an individual one has nobody to remove.
	const hasInactivityRule = group.hizbPlan != null && !group.hizbIndividual;

	const handleSave = (values: EditGroupForm) => {
		const inactivityDays = values.inactivityEnabled ? values.inactivityDays : null;

		updateGroup.mutate({
			// Sent only when it changed: the server starts a new grace period on every change, so
			// saving a new name must not reset it.
			...(hasInactivityRule && inactivityDays !== (group.inactivityDays ?? null) ? { inactivityDays } : {}),
			// Blank is "no intention", which the API stores as null rather than an empty string.
			dedication: values.dedication.trim() === '' ? null : values.dedication.trim(),
			groupId: group.id,
			name: values.name.trim(),
			visibility: group.splitMode === 'FLEXIBLE' && group.hizbPlan == null ? 'OPEN' : values.visibility
		});

		// The tick is the sheet's "done": saved, it closes.
		onClose();
	};

	const confirmDelete = () => {
		deleteGroup.mutate(group.id);
		onClose();
		navigation.navigate('Groups');
	};

	const handleDelete = () => {
		confirmDestructive({
			cancelLabel: t('cancel'),
			confirmLabel: t('deleteGroup'),
			message: t('deleteHint'),
			onConfirm: confirmDelete,
			title: t('deleteGroup')
		});
	};

	const isFlexible = group.splitMode === 'FLEXIBLE' && group.hizbPlan == null;
	const spotsHint = isFlexible
		? t('flexiblePublicHint')
		: `${group.memberCount} / ${group.spots} · ${group.spotsLeft} ${t('spotsLeft')}`;

	return (
		/*
		 * A fixed height and a scroller: content-sized, the sheet ran past the bottom of the
		 * screen and the rows at its end were unreachable. `flex: 1` on the scroller itself, not
		 * just its content — inside a sheet with a detent a scroll view with no flex takes the
		 * height of its *content* and believes it is already showing everything. Same
		 * arrangement as the members sheet.
		 *
		 * No `title` prop: the two controls sit above the heading rather than under it, which is
		 * create-group's arrangement for the same pair, so the heading is drawn here.
		 */
		<AppBottomSheet heightRatio={SHEET_HEIGHT_RATIO} isVisible={isVisible} onClose={onClose}>
			{/*
			 * **The form wraps the whole sheet, so the tick in the corner can submit it.** Keyed
			 * on `isVisible` so it remounts as the sheet opens: `defaultValues` are read once, so
			 * an edit abandoned by closing the sheet would otherwise still be sitting there the
			 * next time it was opened.
			 */}
			<Form<EditGroupForm>
				defaultValues={{
					dedication: group.dedication ?? '',
					inactivityDays: group.inactivityDays ?? 10,
					inactivityEnabled: group.inactivityDays != null,
					name: group.name,
					visibility: group.visibility
				}}
				key={isVisible ? 'open' : 'closed'}
				render={({ handleSubmit, watch }) => (
					<>
						{/*
						 * Destroy on the left, keep on the right — create-group's × / ✓ pair, in the
						 * corners where a sheet's decisions live. Both are icon-only `AppButton`s,
						 * which is the navigation bar's 44pt disc; the tick saves and closes the sheet.
						 */}
						{/*
						 * **Every corner button stays mounted; a page only shows one or the other.** They
						 * are native glass, and one created as the page opened drew its first frame
						 * unplaced and then jumped into the corner. So back sits in delete's slot, and
						 * the tick fades out, rather than either being built on the spot.
						 */}
						<View style={styles.controls}>
							<View style={styles.cornerSlot}>
								<View
									pointerEvents={isSubPage ? 'none' : 'auto'}
									style={[StyleSheet.absoluteFill, isSubPage ? styles.invisible : null]}
								>
									<AppButton
										accessibilityLabel={t('deleteGroup')}
										disabled={deleteGroup.isPending}
										fullWidth={false}
										icon='delete'
										onPress={handleDelete}
										variant='dangerFilled'
									/>
								</View>
								<View
									pointerEvents={isSubPage ? 'auto' : 'none'}
									style={[StyleSheet.absoluteFill, isSubPage ? null : styles.invisible]}
								>
									<AppButton
										accessibilityLabel={t('back')}
										fullWidth={false}
										icon='chevronLeft'
										onPress={() => setPage('manage')}
										variant='surface'
									/>
								</View>
							</View>
							<View
								pointerEvents={isSubPage ? 'none' : 'auto'}
								style={isSubPage ? styles.invisible : null}
							>
								<AppButton
									accessibilityLabel={t('save')}
									disabled={updateGroup.isPending}
									fullWidth={false}
									icon='check'
									onPress={handleSubmit(handleSave)}
									variant='accent'
								/>
							</View>
						</View>
						{/*
						 * Two pages in one frame: the list slides in from the right as Yönet eases off to
						 * the left, and back again. Yönet stays mounted underneath, so an unsaved edit is
						 * still there on the way back.
						 */}
						<View style={styles.pages}>
							<Animated.View
								pointerEvents={isSubPage ? 'none' : 'auto'}
								style={pageTurn(!isSubPage, -1, isReducedMotion)}
							>
								<ScrollView
									contentContainerStyle={styles.body}
									showsVerticalScrollIndicator={false}
									style={styles.scroller}
								>
									<Header2 style={styles.title}>{t('manage')}</Header2>

									{/*
									 * **What the group *is*, in a section of its own** — the same three answers
									 * step 1 of create-group asks for, and the only ones a group can still be
									 * given. `spots`, the split and the cycle are absent because the hundred is
									 * divided by them; the server rejects them too.
									 */}
									<EyebrowText color={theme.colors.faintText} style={styles.sectionLabel}>
										{t('groupDetails')}
									</EyebrowText>
									<View style={styles.form}>
										<Field
											label={t('groupName')}
											name='name'
											placeholder={t('groupNamePlaceholder')}
											useHeadingFont
										/>
										<Field
											label={t('dedication')}
											name='dedication'
											placeholder={t('dedicationHint')}
										/>
										{group.hizbIndividual ? (
											<CaptionText>{t('hpIndividualPrivacy')}</CaptionText>
										) : isFlexible ? (
											<CaptionText>{t('flexiblePublicHint')}</CaptionText>
										) : (
											<>
												<FieldLabelText style={styles.fieldLabel}>
													{t('visibility')}
												</FieldLabelText>
												<FormOptionGroup
													direction='row'
													name='visibility'
													options={[
														{ hint: t('openHint'), title: t('open'), value: 'OPEN' },
														{
															hint: t('privateHint'),
															title: t('private'),
															value: 'PRIVATE'
														}
													]}
												/>
											</>
										)}
									</View>

									{/* Saved by the tick with the details, not on touch: every change starts a new
							    grace period, so stepping through the days must not save each one. */}
									{hasInactivityRule ? (
										<>
											<EyebrowText color={theme.colors.faintText} style={styles.sectionLabel}>
												{t('hpInactivity')}
											</EyebrowText>
											{/* Flush like the access card below: the toggle row brings its own padding. */}
											<CardSurface isFlush style={styles.inactivityCard}>
												<FormToggleRow
													hint={t('hpInactivityHint')}
													name='inactivityEnabled'
													title={t('hpInactivity')}
												/>
												{watch('inactivityEnabled') ? (
													<>
														<Divider />
														<View style={styles.inactivityDays}>
															<FieldLabelText style={styles.fieldLabel}>
																{t('hpInactiveDays')}
															</FieldLabelText>
															<FormStepper
																caption={t('hpDays', { days: watch('inactivityDays') })}
																name='inactivityDays'
																values={INACTIVITY_DAY_OPTIONS}
															/>
														</View>
													</>
												) : null}
											</CardSurface>
										</>
									) : null}

									{/* Who may come in, and who already has: switches that mean something the
							    moment they are touched, so they save on the spot rather than waiting
							    for the tick above. */}
									{!group.hizbIndividual ? (
										<>
											<EyebrowText color={theme.colors.faintText} style={styles.sectionLabel}>
												{t('groupAccess')}
											</EyebrowText>
											<CardSurface isFlush style={styles.card}>
												{/* A Cevşen and Hizb setting only: a hatim's cüz map names who holds
										    each cüz, and nothing there reads the switch. */}
												{group.kind !== 'HATIM' ? (
													<>
														<ToggleRow
															title={t('hideMemberNames')}
															hint={t('hideMemberNamesHint')}
															value={group.hideMemberNames}
															disabled={updateGroup.isPending}
															onValueChange={next =>
																updateGroup.mutate({
																	groupId: group.id,
																	hideMemberNames: next
																})
															}
														/>
														<Divider />
														{/* "Okuma sorumluları" (a shared Hizb plan): the switch, and while it is on,
												    who they are — the owner by default. Names hidden or not. */}
														{isSharedPlan ? (
															<>
																<ToggleRow
																	title={t('hpSeersSwitch')}
																	hint={t('hpSeersSwitchHint')}
																	value={group.readSeersEnabled}
																	disabled={updateGroup.isPending}
																	onValueChange={next =>
																		updateGroup.mutate({
																			groupId: group.id,
																			readSeersEnabled: next
																		})
																	}
																	// Who they are, in the switch's own row while it is on.
																	footer={
																		group.readSeersEnabled ? (
																			<NavRow
																				label={t('hpSeersTitle')}
																				meta={t('hpSeersCount', {
																					count: group.members.filter(
																						member => member.seesReaders
																					).length
																				})}
																				onPress={() => openPage('seers')}
																				style={styles.seersLink}
																			/>
																		) : undefined
																	}
																/>
																<Divider />
															</>
														) : null}
													</>
												) : null}
												<ToggleRow
													hint={spotsHint}
													disabled={isFlexible}
													onValueChange={next =>
														updateGroup.mutate({ groupId: group.id, openToJoin: next })
													}
													title={t('openToJoin')}
													value={group.openToJoin}
												/>
												<Divider />
												<NavRow
													label={t('membersTitle')}
													meta={
														isFlexible
															? String(group.memberCount)
															: `${group.memberCount} / ${group.spots}`
													}
													onPress={() => openPage('members')}
												/>
											</CardSurface>
										</>
									) : null}
								</ScrollView>
							</Animated.View>
							{subPage ? (
								<Animated.View
									pointerEvents={isSubPage ? 'auto' : 'none'}
									style={pageTurn(isSubPage, 1, isReducedMotion)}
								>
									{subPage === 'seers' ? (
										<ReaderSeersPicker group={group} />
									) : (
										<MembersList groupId={group.id} isActive={isVisible && isSubPage} />
									)}
								</Animated.View>
							) : null}
						</View>
					</>
				)}
				schema={schema}
			/>
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	body: {
		flexGrow: 1,
		paddingBottom: 20
	},
	card: {
		marginBottom: 4
	},
	controls: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	fieldLabel: {
		marginTop: 4
	},
	// In the switch's row: its hint's measure, with a hairline's worth of air above.
	seersLink: {
		paddingHorizontal: 0,
		paddingVertical: 6
	},
	inactivityCard: {
		marginBottom: 22
	},
	// The toggle row's own 15, so the stepper lines up under its title.
	inactivityDays: {
		gap: 12,
		padding: 15
	},
	form: {
		gap: 12,
		marginBottom: 22
	},
	scroller: {
		flex: 1
	},
	// The frame both pages slide in, under the corner buttons.
	pages: {
		flex: 1
	},
	// The 44pt disc's own box, so the two buttons sharing it sit in the same place.
	cornerSlot: {
		height: 44,
		width: 44
	},
	invisible: {
		opacity: 0
	},
	/** The heading is the eyebrow's, not the field's — close over the card it names. */
	sectionLabel: {
		marginBottom: 8
	},
	title: {
		fontSize: 21,
		marginBottom: 14
	}
});
