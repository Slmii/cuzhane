import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Field } from '@/components/ui/Form/Field/Field.component';
import { Form } from '@/components/ui/Form/Form.component';
import { FormOptionGroup } from '@/components/ui/Form/OptionGroup/OptionGroup.component';
import { Select } from '@/components/ui/Form/Select/Select.component';
import { FormStepper } from '@/components/ui/Form/Stepper/Stepper.component';
import { FormToggleRow } from '@/components/ui/Form/ToggleRow/ToggleRow.component';
import { SpotsGrid } from '@/components/ui/SpotsGrid/SpotsGrid.component';
import { BodyStrongText, CaptionText, FieldLabelText } from '@/components/ui/Typography/Typography.component';
import { useCreateGroup } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { createGroupSchema, SPOTS_VALUES, type GroupForm } from '@/lib/schemas/group.schema';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { babsPerPerson } from '@/lib/utils/babs';
import { CYCLE_OPTIONS, cycleLabelKey } from '@/lib/utils/groups';
import { RootStackParamList } from '@/navigation/types';
import { deviceTimeZone } from '@/lib/utils/timezone';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { PlanPreview } from '@/components/PlanPreview/PlanPreview.component';
import { CreateGroupStep, CreateGroupStepHeader } from './CreateGroupStepHeader.component';

type CreateGroupScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

/** Tall enough for the busiest step without covering the status bar. */
const SHEET_SNAP_POINTS = ['90%'];
/** The step header is the scroll view's first child, and the one that stays put. */
const STICKY_HEADER_INDICES = [0];

const parseTimeToDate = (time: string) => {
	const [hours, minutes] = time.split(':').map(Number);
	const date = new Date();
	date.setHours(hours ?? 0, minutes ?? 0, 0, 0);

	return date;
};

const formatDateToTime = (date: Date) =>
	`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

export const CreateGroupScreen = ({ navigation }: CreateGroupScreenProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const createGroup = useCreateGroup();
	const schema = useMemo(() => createGroupSchema(t), [t]);

	const [step, setStep] = useState<CreateGroupStep>(1);
	const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);

	/** Dismisses the sheet route, but only while there is still one to dismiss. */
	const handleClose = () => {
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
			isVisible
			// Guarded: on a successful create the route is popped first, and the sheet's own
			// dismiss callback then fires on the way out. Without the check that second
			// `goBack` has no route left to pop and React Navigation warns about an
			// unhandled GO_BACK action.
			onClose={handleClose}
			snapPoints={SHEET_SNAP_POINTS}
		>
			<Form<GroupForm>
				defaultValues={{
					cycle: 'WEEKLY',
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
				render={({ handleSubmit, setValue, watch }) => {
					const spots = watch('spots');

					const handleTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
						if (Platform.OS === 'android') {
							setIsTimePickerVisible(false);
						}

						if (event.type !== 'dismissed' && selectedDate) {
							setValue('reminderTime', formatDateToTime(selectedDate));
						}
					};

					return (
						/*
						 * The header is pinned so that which step you are on, and how far through you
						 * are, stay on screen the whole way down a long form — scrolled away, step 2
						 * lost both the dashes and its own title and the page stopped saying what it
						 * was.
						 *
						 * Pinned with `stickyHeaderIndices` rather than lifted out as a sibling above
						 * the scroll view. As a sibling it looked right but broke the keyboard: this
						 * sheet runs `keyboardBehavior='interactive'`, and gorhom shrinks the sheet's
						 * content while the keyboard is up on the assumption that the scrollable *is*
						 * the content. With something else sharing the column, the height it took away
						 * never came back — dismissing the keyboard left the form cut off mid-button
						 * above a screenful of empty sheet.
						 */
						<BottomSheetScrollView
							contentContainerStyle={styles.sheetContent}
							showsVerticalScrollIndicator={false}
							stickyHeaderIndices={STICKY_HEADER_INDICES}
						>
							<CreateGroupStepHeader onBack={handleBack} step={step} />
							{step === 1 ? (
								<>
									<Field
										label={t('groupName')}
										name='name'
										placeholder={t('groupNamePlaceholder')}
										style={styles.field}
										useHeadingFont
									/>
									<Field
										label={t('dedication')}
										name='dedication'
										placeholder={t('dedicationHint')}
										style={styles.field}
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
									<AppButton
										disabled={watch('name').trim().length === 0}
										onPress={() => setStep(2)}
										style={styles.primaryButton}
										title={t('next')}
									/>
								</>
							) : null}

							{step === 2 ? (
								<>
									<FieldLabelText style={styles.fieldLabel}>{t('spots')}</FieldLabelText>
									<CardSurface style={styles.spotsCard}>
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
									</CardSurface>
									<CaptionText color={theme.colors.faintText} style={styles.spotsNote}>
										{t('spotsNote')}
									</CaptionText>
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
									<PlanPreview
										splitMode={watch('splitMode')}
										spots={spots}
										style={styles.planPreview}
									/>
									<AppButton
										onPress={() => setStep(3)}
										style={styles.primaryButton}
										title={t('next')}
									/>
								</>
							) : null}

							{step === 3 ? (
								<>
									<FieldLabelText style={styles.fieldLabel}>{t('cycle')}</FieldLabelText>
									<Select
										name='cycle'
										options={CYCLE_OPTIONS.map(option => ({
											label: t(cycleLabelKey(option)),
											value: option
										}))}
										style={styles.cycleRow}
									/>

									<FieldLabelText style={styles.fieldLabel}>{t('reminder')}</FieldLabelText>
									<CardSurface isFlush style={styles.reminderCard}>
										<Pressable
											accessibilityRole='button'
											onPress={() => setIsTimePickerVisible(true)}
										>
											<FormToggleRow
												hint={watch('reminderTime')}
												name='reminderEnabled'
												title={t('dailyAt')}
											/>
										</Pressable>
									</CardSurface>

									{isTimePickerVisible ? (
										<View style={styles.pickerWrap}>
											<DateTimePicker
												display={Platform.OS === 'ios' ? 'spinner' : 'default'}
												mode='time'
												onChange={handleTimeChange}
												value={parseTimeToDate(watch('reminderTime'))}
											/>
											{Platform.OS === 'ios' ? (
												<Pressable
													onPress={() => setIsTimePickerVisible(false)}
													style={styles.pickerDone}
												>
													<BodyStrongText color={theme.colors.accent}>
														{t('done')}
													</BodyStrongText>
												</Pressable>
											) : null}
										</View>
									) : null}

									<AppButton
										isLoading={createGroup.isPending}
										onPress={handleSubmit(handleCreate)}
										style={styles.primaryButton}
										title={t('createGroup')}
									/>
								</>
							) : null}
						</BottomSheetScrollView>
					);
				}}
			/>
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	cycleRow: {
		marginBottom: 8
	},
	field: {
		marginBottom: 4
	},
	fieldLabel: {
		marginBottom: 8
	},
	pickerDone: {
		alignItems: 'center',
		paddingVertical: 10
	},
	pickerWrap: {
		marginBottom: 4
	},
	planPreview: {
		marginTop: 11
	},
	primaryButton: {
		marginTop: 8
	},
	reminderCard: {
		marginBottom: 4
	},
	spotsCard: {
		marginBottom: 4
	},
	spotsNote: {
		marginBottom: 4
	},
	sheetContent: {
		gap: 12,
		paddingBottom: 8
	},
	stepper: {
		marginBottom: 14
	}
});
