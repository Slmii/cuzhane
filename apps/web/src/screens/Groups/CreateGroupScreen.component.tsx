import { PlanPreview } from '@/components/PlanPreview/PlanPreview.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { Field } from '@/components/ui/Form/Field/Field.component';
import { Form } from '@/components/ui/Form/Form.component';
import { FormOptionGroup } from '@/components/ui/Form/OptionGroup/OptionGroup.component';
import { Select } from '@/components/ui/Form/Select/Select.component';
import { FormStepper } from '@/components/ui/Form/Stepper/Stepper.component';
import { FormToggleRow } from '@/components/ui/Form/ToggleRow/ToggleRow.component';
import { SpotsGrid } from '@/components/ui/SpotsGrid/SpotsGrid.component';
import { CaptionText, FieldLabelText } from '@/components/ui/Typography/Typography.component';
import { useCreateGroup } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { createGroupSchema, SPOTS_VALUES, type GroupForm } from '@/lib/schemas/group.schema';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { babsPerPerson } from '@/lib/utils/babs';
import { CYCLE_OPTIONS, cycleLabelKey } from '@/lib/utils/groups';
import { deviceTimeZone } from '@/lib/utils/timezone';
import { RootStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CreateGroupStep, CreateGroupStepHeader } from './CreateGroupStepHeader.component';
import { CreatingGroupStep } from './CreatingGroupStep.component';

type CreateGroupScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

/**
 * What each step is allowed to be wrong about.
 *
 * The schema is one flat `createGroupSchema` covering all three steps, so validating on the way
 * forward has to be scoped by hand — `handleSubmit` would fail step 1 on fields that are still
 * two screens away and set errors under inputs nobody has seen. Naming the fields is what keeps
 * the message under the control it belongs to.
 */
const FIELDS_BY_STEP: Record<CreateGroupStep, (keyof GroupForm)[]> = {
	1: ['name', 'dedication', 'visibility'],
	2: ['spots', 'splitMode'],
	3: ['cycle', 'reminderEnabled', 'reminderTime']
};

/** Tall enough for the busiest step without covering the status bar. */
const SHEET_SNAP_POINTS = ['90%'];

export const CreateGroupScreen = ({ navigation }: CreateGroupScreenProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const createGroup = useCreateGroup();
	const schema = useMemo(() => createGroupSchema(t), [t]);

	const [step, setStep] = useState<CreateGroupStep>(1);

	/** Dismisses the sheet route, but only while there is still one to dismiss. */
	/*
	 * **The sheet dismisses first; the route is popped once it has.**
	 *
	 * `isVisible` used to be hardcoded true — the sheet's existence *was* the route, so closing
	 * meant popping, which tore the content down mid-flight. With the content gone the sheet had
	 * nothing left to size itself from and snapped to a fallback detent on its way out: it grew
	 * to full height for a frame and then vanished. Asking it to dismiss and popping on its own
	 * `onClose` lets it animate down the way every other sheet does.
	 */
	const [isSheetVisible, setIsSheetVisible] = useState(true);

	const handleClose = () => setIsSheetVisible(false);

	const handleDismissed = () => {
		// Guarded: a successful create pops to the lobby first, and this fires on the way out
		// with no route left to pop — React Navigation warns about an unhandled GO_BACK.
		if (navigation.canGoBack()) {
			navigation.goBack();
		}
	};

	const handleBack = () => {
		if (step === 1) {
			handleClose();
			return;
		}

		setStep(previous => (previous - 1) as CreateGroupStep);
	};

	const handleCreate = (values: GroupForm) => {
		createGroup.mutate(
			{
				cycle: values.cycle,
				dedication: values.dedication.trim() || undefined,
				name: values.name.trim(),
				reminderEnabled: values.reminderEnabled,
				reminderTime: values.reminderTime,
				spots: values.spots,
				splitMode: values.splitMode,
				// Whoever creates the group sets its clock: rounds roll at midnight here, for
				// every member wherever they are. Not a form field — asking someone to pick a
				// time zone to start a hatim would be absurd.
				timezone: deviceTimeZone(),
				visibility: values.visibility
			},
			{
				onSuccess: created =>
					// `popTo`, not `navigate`: this sheet is a route on the root stack, and
					// navigating to the tabs left it mounted on top — the new group rendered
					// *inside* the sheet surface, rounded corners and all. Popping back to
					// `Tabs` dismisses the sheet and delivers the params in one dispatch, so
					// there's no separate `goBack` to fire an unhandled action.
					//
					// Straight to the lobby: a new group always starts out gathering, so the
					// group board would only redirect there anyway. Inside the Groups tab, so
					// it keeps the bottom bar and a sensible back stack.
					navigation.popTo('Tabs', {
						screen: 'Groups',
						params: { screen: 'Lobby', params: { groupId: created.id } }
					})
			}
		);
	};

	return (
		<AppBottomSheet
			hasScrollableContent
			isVisible={isSheetVisible}
			onClose={handleDismissed}
			snapPoints={SHEET_SNAP_POINTS}
		>
			<Form<GroupForm>
				/*
				 * **`onChange`, because this form is advanced by `trigger` rather than submitted.**
				 * The default `onSubmit` only re-validates once `isSubmitted` is true, and stepping
				 * forward never submits — so an error `trigger` had set stayed on screen however
				 * much you typed. Validating on change lets the message clear itself the moment
				 * the field is right, which is the only way it ever goes away here.
				 */
				mode='onChange'
				defaultValues={{
					cycle: 'DAILY',
					dedication: '',
					name: '',
					reminderEnabled: true,
					reminderTime: '21:00',
					spots: 20,
					splitMode: 'ROTATION',
					visibility: 'OPEN'
				}}
				isDisabled={createGroup.isPending}
				schema={schema}
				render={({ handleSubmit, trigger, watch }) => {
					const spots = watch('spots');

					/*
					 * **Forward is a validation, not just a state change.** The step buttons used
					 * to be plain `setStep` calls guarded by a `disabled` prop, so the only thing
					 * stopping an empty name was the button being unpressable — nothing ever ran
					 * the schema or set an error. `trigger` validates this step's fields, fills
					 * `formState.errors`, and the bound `Field`s render their own messages.
					 */
					const handleNext = async () => {
						if (await trigger(FIELDS_BY_STEP[step])) {
							setStep(previous => (previous + 1) as CreateGroupStep);
						}
					};

					return (
						/*
						 * **The header is a sibling above the scroll view, not a sticky child of it.**
						 * Which step you are on, and how far through, stays on screen the whole way
						 * down a long form — scrolled away, step 2 lost both the dashes and its own
						 * title and the page stopped saying what it was.
						 *
						 * It was pinned with `stickyHeaderIndices` instead, because as a sibling it
						 * broke gorhom's keyboard handling: that sheet shrank its content while the
						 * keyboard was up on the assumption that the scrollable *was* the content, and
						 * with something else sharing the column the height it took away never came
						 * back. The sheet is presented by the platform now and the keyboard is the
						 * OS's business, so the constraint is gone — and pinning had a cost of its
						 * own. A sticky header must paint something to hide what slides under it, and
						 * on the platform's own material there is no colour of ours to paint; the
						 * form ran straight through the title, and the spots stepper landed on top of
						 * "Geri" and swallowed the tap.
						 */
						<View style={styles.sheetColumn}>
							{createGroup.isPending ? (
								<CreatingGroupStep />
							) : (
								<CreateGroupStepHeader
									onBack={handleBack}
									onNext={step === 3 ? handleSubmit(handleCreate) : () => void handleNext()}
									step={step}
								/>
							)}
							<ScrollView
								contentContainerStyle={styles.sheetContent}
								showsVerticalScrollIndicator={false}
							>
								{!createGroup.isPending && step === 1 ? (
									<>
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
										<FieldLabelText style={styles.fieldLabel}>{t('visibility')}</FieldLabelText>
										<FormOptionGroup
											direction='row'
											name='visibility'
											options={[
												{ hint: t('openHint'), title: t('open'), value: 'OPEN' },
												{ hint: t('privateHint'), title: t('private'), value: 'PRIVATE' }
											]}
										/>
									</>
								) : null}

								{!createGroup.isPending && step === 2 ? (
									<>
										<FieldLabelText style={styles.fieldLabel}>{t('spots')}</FieldLabelText>
										<View style={styles.spotsCard}>
											{/* Three sizes, not a range: 5, 10 and 20 each divide the hundred
										    evenly, so +/- walk the list rather than adding a constant. */}
											<FormStepper
												caption={t('perPersonTr', { perBab: babsPerPerson(spots), spots })}
												name='spots'
												style={styles.stepper}
												values={SPOTS_VALUES}
											/>
											{/* Every seat is a seat that will be filled — the grid shows the
										    capacity being chosen, not who has joined yet. */}
											<SpotsGrid filled={spots} total={spots} />
										</View>
										<CaptionText color={theme.colors.faintText}>{t('spotsNote')}</CaptionText>
										<FieldLabelText style={styles.fieldLabel}>{t('readingPlan')}</FieldLabelText>
										<FormOptionGroup
											direction='column'
											name='splitMode'
											options={[
												{
													hint: t('planRotationHint'),
													title: t('planRotation'),
													value: 'ROTATION'
												},
												{ hint: t('planFixedHint'), title: t('planFixed'), value: 'FIXED' }
											]}
										/>
										<PlanPreview splitMode={watch('splitMode')} spots={spots} />
									</>
								) : null}

								{!createGroup.isPending && step === 3 ? (
									<>
										<FieldLabelText style={styles.fieldLabel}>{t('cycle')}</FieldLabelText>
										<Select
											name='cycle'
											options={CYCLE_OPTIONS.map(option => ({
												label: t(cycleLabelKey(option)),
												value: option
											}))}
										/>

										{/*
										 * **The switch and nothing else — no time picker here.**
										 * Creating a group asks whether you want a daily reminder,
										 * not when: the time is a personal setting that Hatırlatma
										 * owns, with its own picker, its debounce and the note about
										 * a first notification landing tomorrow. A second picker on
										 * this step made the same choice in a worse place, and set
										 * it per group when the reminder is not per group at all.
										 * The row still shows the time so the switch says what it
										 * will do; `reminderTime` keeps its 21:00 default.
										 */}
										<FieldLabelText style={styles.fieldLabel}>{t('reminder')}</FieldLabelText>
										<FormToggleRow
											hint={watch('reminderTime')}
											name='reminderEnabled'
											title={t('dailyAt')}
										/>

										{/*
										 * No `isLoading` spinner: `CreatingGroupOverlay` covers the whole
										 * sheet the moment this is pressed, so a spinner in the button
										 * would be a second wait indicator underneath the first. The
										 * button stays disabled via `isDisabled` on the step above.
										 */}
									</>
								) : null}
							</ScrollView>
						</View>
					);
				}}
			/>
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	/** Header above, the form scrolling in what is left — the sheet gives the column its height. */
	sheetColumn: {
		flex: 1
	},
	fieldLabel: {
		marginBottom: 8
	},
	/**
	 * **The same 12 below the last section as between any two sections**, on every step.
	 *
	 * It used to carry `marginTop: 'auto'`, which absorbed whatever slack the column had: on a
	 * short step that flung the button to the foot of the sheet, and on a long one it collapsed
	 * to nothing extra — so the gap above it changed from step to step and matched the rest of
	 * the form on neither. The container's `gap` is the only spacing now, as it is everywhere
	 * else on this screen.
	 */
	spotsCard: {
		// Was `CardSurface`'s own `spacing.md`; the card is gone, the inset it gave is not.
		padding: 16
	},
	/*
	 * **`gap` is the only spacing between sections, and it is the 12 Gruplarım's list uses.**
	 * Every block here used to add a `marginBottom` of its own on top of it — 4 here, 8 there,
	 * 11 under the plan preview — so no two steps had the same rhythm and the Devam button sat
	 * closer to the card above it than anything else on the page. Same mistake the group screen
	 * and Profile made; add nothing per child.
	 */
	/**
	 * **The step's action needs its own top margin, on top of the container's `gap`.**
	 *
	 * A glass `AppButton` is an `@expo/ui` `Host` measuring itself with `matchContents`, and it
	 * reports a frame shorter than the capsule it draws — so the capsule bleeds up into the gap
	 * and Devam sat flush against the card above it while every other pair on the step was a
	 * clean 12. This is the difference, not a second opinion about the spacing.
	 */
	sheetContent: {
		flexGrow: 1,
		gap: 12,
		paddingBottom: 8
	},
	stepper: {
		marginBottom: 14
	}
});
