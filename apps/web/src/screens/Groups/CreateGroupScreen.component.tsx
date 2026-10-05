import { PlanPreview } from '@/components/PlanPreview/PlanPreview.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { CuzPicker } from '@/components/CuzPicker/CuzPicker.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Collapsible } from '@/components/ui/Collapsible/Collapsible.component';
import { Divider } from '@/components/ui/Divider/Divider.component';
import { Field } from '@/components/ui/Form/Field/Field.component';
import { Form } from '@/components/ui/Form/Form.component';
import { FormKindOptionGroup } from '@/components/ui/Form/KindOptionGroup/KindOptionGroup.component';
import { FormOptionGroup } from '@/components/ui/Form/OptionGroup/OptionGroup.component';
import { Select } from '@/components/ui/Form/Select/Select.component';
import { FormStepper } from '@/components/ui/Form/Stepper/Stepper.component';
import { FormToggleRow } from '@/components/ui/Form/ToggleRow/ToggleRow.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { NoteCard } from '@/components/ui/NoteCard/NoteCard.component';
import { SpotsGrid } from '@/components/ui/SpotsGrid/SpotsGrid.component';
import { ToggleRow } from '@/components/ui/ToggleRow/ToggleRow.component';
import { BodyStrongText, BodyText, CaptionText, FieldLabelText } from '@/components/ui/Typography/Typography.component';
import { useCreateGroup } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { pluralKey } from '@/lib/i18n/plural';
import type { StringKey } from '@/lib/i18n/strings';
import {
	createGroupSchema,
	CUZ_COUNT,
	ROUND_DAYS_MAX,
	ROUND_DAYS_PRESETS,
	type GroupForm
} from '@/lib/schemas/group.schema';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupKind } from '@/lib/types/domain';
import { babsPerPerson, formatBabRange } from '@/lib/utils/babs';
import { CREATE_DEFAULTS_FOR_KIND, partCountFor, PERSONAL_PLAN_MAX_DAYS, SPOTS_FOR_KIND } from '@/lib/utils/groupKinds';
import { cycleLabelKey, cycleOptionsFor, hizbPartsLabel } from '@/lib/utils/groups';
import { boardPortionsOf } from '@/lib/utils/hizbPlanBoard';
import { hizbPlanDescriptionKey } from '@/lib/utils/hizbPlanLabels';
import {
	CUSTOM_PLAN_DAYS,
	isPersonalPlanKind,
	PLAN_DAY_PRESETS,
	planDayValues,
	planSplit
} from '@/lib/utils/personalPlan';
import { roundEndPreview } from '@/lib/utils/roundReset';
import { deviceTimeZone } from '@/lib/utils/timezone';
import { unitLabelKey } from '@/lib/utils/units';
import { RootStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CreateGroupDurationCard } from './CreateGroupDurationCard.component';
import {
	CreateGroupStep,
	CreateGroupStepHeader,
	LAST_STEP_BY_KIND,
	lastStepFor
} from './CreateGroupStepHeader.component';
import { CreatingGroupStep } from './CreatingGroupStep.component';

type CreateGroupScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

/**
 * What each step is allowed to be wrong about.
 *
 * The schema is one flat `createGroupSchema` covering every step, so validating on the way
 * forward has to be scoped by hand — `handleSubmit` would fail step 2 on fields that are still
 * two screens away and set errors under inputs nobody has seen. Naming the fields is what keeps
 * the message under the control it belongs to.
 *
 * **Scoped by kind as well as by step**, for the same reason: steps 3 and 4 ask a Cevşen group
 * about seats and a cadence, a hatim about distribution and a round length, and a Hizb group
 * about its reading plan, and the fields for the branches not taken are never rendered.
 * Validating them would block a step on a control that does not exist.
 */
const FIELDS_BY_STEP: Record<GroupKind, Record<CreateGroupStep, (keyof GroupForm)[]>> = {
	CEVSEN: {
		1: ['kind'],
		2: ['name', 'dedication', 'visibility', 'hideMemberNames'],
		3: ['spots', 'splitMode', 'cycle'],
		// Unreachable — a Cevşen group ends at step 3. See `LAST_STEP_BY_KIND`.
		4: [],
		5: []
	},
	HATIM: {
		1: ['kind'],
		2: ['name', 'dedication', 'visibility'],
		3: ['distribution', 'hasMaxPerMember', 'maxPerMember'],
		4: ['roundDays', 'boundaryPolicy'],
		// QC4's picks are held outside the form — see `selectedCuz`. Nothing to validate here;
		// the ✓ is disabled until at least one is chosen.
		5: []
	},
	HIZB: {
		1: ['kind'],
		2: ['name', 'dedication', 'visibility', 'hideMemberNames'],
		3: ['spots', 'splitMode', 'hizbPlan'],
		4: ['cycle', 'inactivityDays', 'hizbStartPortion'],
		// Unreachable — a Hizb group ends at step 4.
		5: []
	}
};

/** A Şahsi Cevşen or Kur'an reading's three steps: the book, its name, and how many days. */
const PERSONAL_FIELDS_BY_STEP: Record<CreateGroupStep, (keyof GroupForm)[]> = {
	1: ['kind', 'hizbIndividual'],
	2: ['name', 'dedication'],
	3: ['planDays'],
	// Unreachable — see `lastStepFor`.
	4: [],
	5: []
};

/**
 * **One height for every step, and it never changes.** Sized for step 3, which is the tallest
 * either kind gets — a Cevşen group's seat stepper, hundred-cell grid, cadence chips, plan
 * options and their preview; a hatim's three distribution cards over its own stepper. That
 * step scrolls, which is exactly what the `flex: 1` on the scroller below is for.
 *
 * Two reasons it is a single constant rather than something per step.
 *
 * The first is a bug. `@expo/ui`'s `BottomSheetView.swift` chooses between fitting to content and
 * honouring detents with a SwiftUI `if props.fitToContents`, which is a *structural* branch:
 * flipping it swaps `_ConditionalContent` arms, so SwiftUI tears down one arm and builds the
 * other, **taking the hosted React Native surface with it**. Giving step 2 alone a detent
 * therefore remounted the whole form on the way in and again on the way out, reverting the name
 * and dedication to their defaults — which then blocked creating the group on the last step.
 *
 * The second is that a resize between steps cannot be made to look like anything. The fitted
 * detent is assigned outside any animation transaction, so the sheet jumps rather than settling,
 * and no JS reaches that — `withAnimation` only covers `useNativeState`. A sheet that does not
 * change height has no transition to get wrong, and the steps read as pages of one sheet rather
 * than as four sheets of different sizes.
 *
 * A Hizb group's plan options, and the Cevşen's seat lattice under a flexible plan's absence, fit
 * inside the same height; anything taller scrolls, never the sheet. A remount would also drop the
 * book chosen at step 1.
 *
 * The cost is accepted deliberately: the shorter steps carry some room below their last control.
 */
const SHEET_HEIGHT_RATIO = 0.82;

/** The tallest each kind's seat lattice gets, which is the height it always reserves. */
const MAX_SPOTS_FOR_KIND: Record<GroupKind, number> = {
	CEVSEN: Math.max(...SPOTS_FOR_KIND.CEVSEN),
	HATIM: Math.max(...SPOTS_FOR_KIND.HATIM),
	HIZB: Math.max(...SPOTS_FOR_KIND.HIZB)
};

/** Ten a row for the Cevşen's twenty, eleven for the Hizb — its 32 fill three rows. */
const SPOTS_COLUMNS_FOR_KIND: Record<GroupKind, number> = { CEVSEN: 10, HATIM: 10, HIZB: 11 };

// A hatim is never shown the seat lattice; its entry keeps the record total.
const SPOTS_NOTE_KEY_FOR_KIND: Record<GroupKind, StringKey> = {
	CEVSEN: 'spotsNote',
	HATIM: 'spotsNote',
	HIZB: 'spotsNoteHizb'
};

/**
 * QC2's cap walks every number from one cüz to all thirty — unlike the seat stepper, whose
 * three values are the only ones that divide the hundred evenly.
 */
const MAX_PER_MEMBER_VALUES = Array.from({ length: CUZ_COUNT }, (_, index) => index + 1);

/** QC3's stepper: any length up to a quarter, with 7 and 30 also reachable as presets. */
const ROUND_DAYS_VALUES = Array.from({ length: ROUND_DAYS_MAX }, (_, index) => index + 1);

/** How many days without a completed reading before a Hizb reader is removed: up to a year. */
const INACTIVITY_DAY_OPTIONS = Array.from({ length: 365 }, (_, index) => index + 1);

/**
 * What each preset is called. Keyed by the length rather than positionally, so adding one
 * cannot silently shift the labels along — which is exactly what a `preset === 7 ? … : …`
 * chain does the moment a third is inserted before it.
 *
 * The same three names `cycleLabelKey` gives a group once it exists, so a hatim created as
 * "Aylık" is not called something else on the shelf an hour later.
 */
const ROUND_DAYS_PRESET_KEYS: Record<number, StringKey> = { 1: 'daily', 7: 'weekly', 30: 'qMonthly' };

/** Stable empty array — a fresh literal each render would re-memoise the picker's sets. */
const NO_TAKEN_CUZ: number[] = [];

/**
 * Where "Özel" starts from — the frame's own example. It must differ from both presets, or
 * tapping the card would light one of them up instead of itself.
 */
const CUSTOM_ROUND_DAYS = 10;

/**
 * An individual plan's starting day as the group card will name it: "15 gün · 5. gün · 11–13. bölüm".
 * A start past a shorter plan's end (32 → 15 after choosing 20) waits for the stepper to clamp it.
 */
const startPortionCaption = (days: number, start: number, t: ReturnType<typeof useTranslation>['t']) => {
	const day = t('hpPlanDay', { day: start, days });

	return Number.isInteger(start) && start >= 1 && start <= days
		? `${day} · ${hizbPartsLabel(formatBabRange(boardPortionsOf(days, start)), t)}`
		: day;
};

export const CreateGroupScreen = ({ navigation }: CreateGroupScreenProps) => {
	const { theme } = useThemeContext();
	const { language, t } = useTranslation();
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
	 * `onDismissed` lets it animate down the way every other sheet does.
	 *
	 * **`onDismissed`, not `onClose`.** `onClose` fires only for a dismissal the *reader*
	 * performed; closing with the ✕ sets `isVisible` false, which is the case it suppresses — so
	 * the route never popped and its transparent modal stayed over the app, eating every touch
	 * while the screen underneath looked perfectly normal.
	 */
	/**
	 * QC4's selection. **State, not a form field**: `react-hook-form` binds controls, and this
	 * is a set built by tapping thirty cells — there is no input whose value it is. It is also
	 * the one answer the ✓ is gated on rather than validated for, since a schema error under a
	 * grid has nowhere to render.
	 */
	const [selectedCuz, setSelectedCuz] = useState<number[]>([]);
	// "Başka süre" chosen: it stays open while its stepper passes 10, 15 or 30.
	const [isCustomPlanChosen, setIsCustomPlanChosen] = useState(false);

	const toggleCuz = (cuzNumber: number) =>
		setSelectedCuz(previous =>
			previous.includes(cuzNumber)
				? previous.filter(number => number !== cuzNumber)
				: [...previous, cuzNumber].sort((a, b) => a - b)
		);

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
		const kind = values.kind;
		const isPersonal = isPersonalPlanKind(kind) && values.hizbIndividual;
		const isFlexible = !isPersonal && values.splitMode === 'FLEXIBLE';
		const common = {
			dedication: values.dedication.trim() || undefined,
			name: values.name.trim(),
			/*
			 * Not asked for and not shown, but `CreateGroupBodySchema` still requires
			 * `reminderTime` — the columns are on `Group` and the serializer still returns
			 * them, even though nothing in the app reads either. Sent as the values the
			 * schema would have defaulted to, so removing the control changed no rows.
			 * Dropping the columns needs a migration and is a separate decision.
			 */
			reminderEnabled: true,
			reminderTime: '21:00',
			// Whoever creates the group sets its clock: rounds roll at midnight here, for
			// every member wherever they are. Not a form field — asking someone to pick a
			// time zone to start a hatim would be absurd.
			timezone: deviceTimeZone(),
			// A flexible group is open by definition — step 2 does not offer it "Özel". A Şahsi
			// reading is one person's, so private.
			visibility: isPersonal ? ('PRIVATE' as const) : isFlexible ? ('OPEN' as const) : values.visibility
		};

		createGroup.mutate(
			/*
			 * **The form is flat; the payload is not.** Only the part the chosen kind was
			 * actually asked about is sent, so the other kinds' defaults — which no control on
			 * screen ever set — cannot reach the server and become immutable columns on a group
			 * nobody configured that way.
			 */
			isPersonal
				? { ...common, kind, planDays: values.planDays }
				: values.kind === 'HATIM'
				? {
						...common,
						boundaryPolicy: values.boundaryPolicy,
						distribution: values.distribution,
						cuzNumbers: selectedCuz,
						kind: 'HATIM',
						// Null is "no cap", which is what the switch being off means. The number
						// itself is kept in the form so turning the switch back on restores it.
						maxPerMember: values.hasMaxPerMember ? values.maxPerMember : null,
						roundDays: values.roundDays
				  }
				: values.kind === 'HIZB'
				? {
						...common,
						// A Hizb group's rhythm is its plan: a portion a day, whatever the plan's length.
						cycle: 'DAILY',
						hideMemberNames: values.hideMemberNames,
						hizbIndividual: values.hizbIndividual,
						hizbPlan: Number(values.hizbPlan),
						hizbStartPortion: values.hizbIndividual ? values.hizbStartPortion : 1,
						inactivityDays:
							!values.hizbIndividual && values.inactivityEnabled ? values.inactivityDays : null,
						kind: 'HIZB',
						readSeersEnabled: !values.hizbIndividual && values.readSeersEnabled,
						splitMode: values.splitMode,
						spots: isFlexible ? partCountFor('HIZB') : values.spots
				  }
				: {
						...common,
						cycle: values.cycle,
						hideMemberNames: values.hideMemberNames,
						kind: 'CEVSEN',
						splitMode: values.splitMode,
						spots: isFlexible ? partCountFor('CEVSEN') : values.spots
				  },
			{
				onSuccess: created =>
					// `popTo`, not `navigate`: this sheet is a route on the root stack, and
					// navigating to the tabs left it mounted on top — the new group rendered
					// *inside* the sheet surface, rounded corners and all. Popping back to
					// `Tabs` dismisses the sheet and delivers the params in one dispatch, so
					// there's no separate `goBack` to fire an unhandled action.
					//
					// A hatim goes straight to its lobby: it always starts out gathering, so the
					// group board would only redirect there anyway. Any other group — a Şahsi Kur'an
					// reading too, which runs from the start — opens on itself: "how the group works"
					// (O1–O5) is for joiners — the creator has just set it up.
					// Inside the Groups tab, so it keeps the bottom bar and a sensible back stack.
					navigation.popTo('Tabs', {
						screen: 'Groups',
						params:
							created.kind === 'HATIM' && created.planDays == null
								? { screen: 'Lobby' as const, params: { groupId: created.id } }
								: { screen: 'GroupDetail' as const, params: { groupId: created.id } }
					})
			}
		);
	};

	// The same height on every step — see `SHEET_HEIGHT_RATIO`. Never make this conditional.
	return (
		<AppBottomSheet heightRatio={SHEET_HEIGHT_RATIO} isVisible={isSheetVisible} onDismissed={handleDismissed}>
			<Form<GroupForm>
				/*
				 * **`onChange`, because this form is advanced by `trigger` rather than submitted.**
				 * The default `onSubmit` only re-validates once `isSubmitted` is true, and stepping
				 * forward never submits — so an error `trigger` had set stayed on screen however
				 * much you typed. Validating on change lets the message clear itself the moment
				 * the field is right, which is the only way it ever goes away here.
				 */
				mode='onChange'
				// The Cevşen's, because its card is the one selected on arrival; choosing another kind
				// at step 1 swaps that kind's own three in (`handleKindChange`).
				defaultValues={{
					...CREATE_DEFAULTS_FOR_KIND.CEVSEN,
					boundaryPolicy: 'KEEP',
					dedication: '',
					distribution: 'FREE_PICK',
					hideMemberNames: false,
					hizbIndividual: false,
					hizbPlan: '32',
					hizbStartPortion: 1,
					inactivityDays: 10,
					inactivityEnabled: false,
					kind: 'CEVSEN',
					maxPerMember: 3,
					name: '',
					planDays: 30,
					roundDays: 30,
					visibility: 'OPEN'
				}}
				isDisabled={createGroup.isPending}
				schema={schema}
				render={({ handleSubmit, setValue, trigger, watch }) => {
					const spots = watch('spots');
					const kind = watch('kind');
					const roundDays = watch('roundDays');
					const hasMaxPerMember = watch('hasMaxPerMember');
					// "Özel" is every length that is not one of the two presets.
					const isCustomRoundLength = !ROUND_DAYS_PRESETS.includes(roundDays);
					const individual = kind === 'HIZB' && watch('hizbIndividual');
					// A Şahsi Cevşen or Kur'an reading: three steps, the last asking only how many days.
					const isPersonal = isPersonalPlanKind(kind) && watch('hizbIndividual');
					const planDays = watch('planDays');
					// "Başka süre" once tapped — or any length that is not one of the cards.
					const isCustomPlanLength =
						isCustomPlanChosen || !PLAN_DAY_PRESETS.some(preset => preset === planDays);
					const lastStep = lastStepFor(kind, isPersonal);
					const isFlexible = !isPersonal && kind !== 'HATIM' && watch('splitMode') === 'FLEXIBLE';
					// What a plan length comes to a day, in plain words: "Günde 7 bab · son 5 gün 6".
					const splitLine = (days: number) => {
						if (!isPersonalPlanKind(kind)) {
							return '';
						}

						const split = planSplit(kind, days);
						const unit = t(unitLabelKey(kind));

						return split.lastDays > 0
							? t('spSplitUneven', {
									count: split.perDay,
									days: split.lastDays,
									last: split.lastPerDay,
									unit
							  })
							: t('spSplitEven', { count: split.perDay, unit });
					};
					// A card's own line is short: "Günde 6–7 bab".
					const splitHint = (days: number) => {
						if (!isPersonalPlanKind(kind)) {
							return '';
						}

						const split = planSplit(kind, days);

						return t('spSplitEven', {
							count: split.lastDays > 0 ? `${split.lastPerDay}–${split.perDay}` : split.perDay,
							unit: t(unitLabelKey(kind))
						});
					};
					const perPart = babsPerPerson(spots, partCountFor(kind));
					// The Hizb's line names its own unit, and "1 portion" and a lone seat are lines of
					// their own — see `perPersonHizbOne` / `perPersonHizbSolo`. The Cevşen's is the
					// one it has always had.
					const hizbCaptionKey: StringKey =
						spots === 1 ? 'perPersonHizbSolo' : perPart === 1 ? 'perPersonHizbOne' : 'perPersonHizb';
					const spotsCaption =
						kind === 'HIZB'
							? t(hizbCaptionKey, { perPart, spots })
							: t('perPersonTr', { perBab: perPart, spots });

					/*
					 * **A new kind starts from that kind's own defaults.** Everything after step 2
					 * depends on the book: a size picked for the Cevşen is not a Hizb default (and
					 * most Hizb sizes are not Cevşen sizes at all), and a month chosen for the Hizb
					 * is a cycle the Cevşen refuses. Resetting all three is what keeps a trip back to
					 * step 1 from carrying a value the new kind's controls cannot show. Only on an
					 * actual change — `FormKindOptionGroup` doesn't call this for the card already
					 * chosen — so re-tapping it keeps what was set. A hatim's own answers (its cap,
					 * its round length, its cüz) are separate fields and are kept.
					 */
					const handleKindChange = (next: GroupKind) => {
						const defaults = CREATE_DEFAULTS_FOR_KIND[next];

						setValue('spots', defaults.spots);
						setValue('splitMode', defaults.splitMode);
						setValue('cycle', defaults.cycle);

						// "Şahsi okuma" stays as it was; a length past the new book's range comes down to it.
						if (isPersonalPlanKind(next)) {
							setValue('planDays', Math.min(watch('planDays'), PERSONAL_PLAN_MAX_DAYS[next]));
						} else if (watch('hizbIndividual') && watch('hizbPlan') === '0') {
							setValue('hizbPlan', '32');
						}
					};

					/*
					 * **Forward is a validation, not just a state change.** The step buttons used
					 * to be plain `setStep` calls guarded by a `disabled` prop, so the only thing
					 * stopping an empty name was the button being unpressable — nothing ever ran
					 * the schema or set an error. `trigger` validates this step's fields, fills
					 * `formState.errors`, and the bound `Field`s render their own messages.
					 */
					const handleNext = async () => {
						if (await trigger((isPersonal ? PERSONAL_FIELDS_BY_STEP : FIELDS_BY_STEP[kind])[step])) {
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
						 *
						 * `flex: 1` so the column fills the detent — the wrapper hands fixed-height
						 * sheets a `flexGrow: 1, height: 0` parent, and without a flex of its own the
						 * column would sit at content height with the rest of the sheet empty below.
						 */
						<View style={styles.sheetColumn}>
							{createGroup.isPending ? (
								<CreatingGroupStep
									isFlexible={isFlexible}
									isPersonal={isPersonal || individual}
									kind={kind}
								/>
							) : (
								<CreateGroupStepHeader
									/*
									 * The ✓ cannot create a hatim nobody reads. Gated rather than
									 * validated because the answer is a grid, not a field — a schema
									 * error would have no control to render itself under. The server's
									 * body schema refuses an empty selection too, so this is the
									 * courtesy rather than the rule.
									 */
									isNextDisabled={
										kind === 'HATIM' &&
										!isPersonal &&
										step === LAST_STEP_BY_KIND.HATIM &&
										selectedCuz.length === 0
									}
									isPersonal={isPersonal}
									kind={kind}
									onBack={handleBack}
									onNext={step === lastStep ? handleSubmit(handleCreate) : () => void handleNext()}
									step={step}
									titleKey={
										// A personal Hizb plan's fourth step asks where it starts, not about idle members;
										// a Şahsi reading's third, how many days.
										kind === 'HIZB' && step === 4 && individual
											? 'hpStartPortion'
											: isPersonal && step === 3
											? 'hpPlan'
											: undefined
									}
								/>
							)}
							{/*
							 * `flex: 1` on the scroller itself, not just its content: the sheet has a
							 * fixed height, and a scroll view with no flex inside one takes the height
							 * of its *content* — so a step longer than the sheet would grow past the
							 * bottom edge instead of scrolling, with its last controls unreachable.
							 */}
							<ScrollView
								contentContainerStyle={styles.sheetContent}
								showsVerticalScrollIndicator={false}
								style={styles.scroller}
							>
								{!createGroup.isPending && step === 1 ? (
									<>
										<CaptionText color={theme.colors.subtext}>{t('qWhatReadSub')}</CaptionText>
										<FormKindOptionGroup
											name='kind'
											onChange={handleKindChange}
											style={styles.kindCards}
										/>
										{/*
										 * The "Şahsi okuma" switch under every book: read alone, a day at a
										 * time. Then, under the Hizb, the note on how its portions come; under
										 * the others, Q1's note on how a Kur'an group differs. All sit below
										 * the cards, so appearing moves nothing above.
										 */}
										<CardSurface isFlush>
											<ToggleRow
												hint={t('hpIndividualHint')}
												onValueChange={next => {
													setValue('hizbIndividual', next);
													if (next && kind === 'HIZB' && watch('hizbPlan') === '0') {
														setValue('hizbPlan', '32');
													}
												}}
												title={t('hpIndividual')}
												value={watch('hizbIndividual')}
											/>
										</CardSurface>
										{kind === 'HIZB' ? (
											<>
												<CardSurface style={styles.kindNoteCard}>
													<View style={styles.kindNote}>
														<Icon
															color={theme.colors.accent}
															name='info'
															size={17}
															strokeWidth={1.8}
															style={styles.kindNoteIcon}
														/>
														<BodyText
															color={theme.colors.subtext}
															style={styles.kindNoteText}
														>
															{t('hpDailyHint')}
														</BodyText>
													</View>
												</CardSurface>
											</>
										) : kind === 'HATIM' && !isPersonal ? (
											// A Kur'an group's cüz-taking; nothing a Cevşen or a Şahsi reading does.
											<NoteCard text={t('qTypeNote')} />
										) : null}
									</>
								) : null}

								{!createGroup.isPending && step === 2 ? (
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
										{!individual && !isPersonal ? (
											<>
												<FieldLabelText style={styles.fieldLabel}>
													{t('visibility')}
												</FieldLabelText>
												<FormOptionGroup
													direction='row'
													name='visibility'
													options={[
														{ hint: t('openHint'), title: t('open'), value: 'OPEN' },
														// A flexible group is open to anyone — see `flexiblePublicHint`.
														...(!isFlexible
															? [
																	{
																		hint: t('privateHint'),
																		title: t('private'),
																		value: 'PRIVATE'
																	}
															  ]
															: [])
													]}
												/>
												{/*
												 * Member privacy is a Cevşen and Hizb setting: a hatim's cüz map
												 * names who holds each cüz, and nothing there reads the switch.
												 */}
												{kind !== 'HATIM' ? (
													<CardSurface isFlush>
														<ToggleRow
															hint={t('hideMemberNamesHint')}
															onValueChange={next => setValue('hideMemberNames', next)}
															title={t('hideMemberNames')}
															value={watch('hideMemberNames')}
														/>
														{/* A Hizb plan's owner starts as the one responsible; the rest are
														    chosen in Yönet once people have joined. */}
														{kind === 'HIZB' ? (
															<>
																<Divider />
																<ToggleRow
																	hint={t('hpSeersSwitchCreateHint')}
																	onValueChange={next =>
																		setValue('readSeersEnabled', next)
																	}
																	title={t('hpSeersSwitch')}
																	value={watch('readSeersEnabled')}
																/>
															</>
														) : null}
													</CardSurface>
												) : null}
											</>
										) : (
											<BodyText>{t('hpIndividualPrivacy')}</BodyText>
										)}
									</>
								) : null}

								{/* QC2 — how a hatim's thirty cüz are handed out, and how many one person may hold. */}
								{/*
								 * A Şahsi reading's length — the Kur'an's "Tek seferlik" cards and stepper, for a plan
								 * that comes round again. What it comes to a day is said under them.
								 */}
								{!createGroup.isPending && step === 3 && isPersonal && isPersonalPlanKind(kind) ? (
									<>
										<CaptionText color={theme.colors.subtext}>{t('spPlanHint')}</CaptionText>
										<View style={styles.durationRow}>
											{PLAN_DAY_PRESETS.map(preset => (
												<CreateGroupDurationCard
													hint={splitHint(preset)}
													isSelected={!isCustomPlanLength && planDays === preset}
													key={preset}
													onPress={() => {
														setIsCustomPlanChosen(false);
														setValue('planDays', preset, { shouldValidate: true });
													}}
													style={styles.durationCard}
													title={t('hpDays', { days: preset })}
												/>
											))}
										</View>
										<CreateGroupDurationCard
											hint={t('qCustomHint')}
											isSelected={isCustomPlanLength}
											onPress={() => {
												if (!isCustomPlanLength) {
													setValue('planDays', CUSTOM_PLAN_DAYS, { shouldValidate: true });
												}
												setIsCustomPlanChosen(true);
											}}
											title={t('spCustom')}
										>
											<Collapsible isOpen={isCustomPlanLength}>
												<View
													style={[
														styles.capDivider,
														{ backgroundColor: theme.colors.divider }
													]}
												/>
												<View style={styles.capBody}>
													<FormStepper
														caption={t(pluralKey(language, planDays, 'qDaysOne', 'qDays'))}
														name='planDays'
														values={planDayValues(kind)}
													/>
													<CaptionText color={theme.colors.faintText}>
														{t('spRepeatNote')}
													</CaptionText>
												</View>
											</Collapsible>
										</CreateGroupDurationCard>
										<CardSurface hasGlassSurface={false} style={styles.roundEndRow}>
											<Icon
												color={theme.colors.faintText}
												name='calendar'
												size={15}
												strokeWidth={1.7}
											/>
											<CaptionText style={styles.roundEndValue} weight='semibold'>
												{splitLine(planDays)}
											</CaptionText>
										</CardSurface>
									</>
								) : null}

								{!createGroup.isPending && step === 3 && kind === 'HATIM' && !isPersonal ? (
									<>
										<FieldLabelText style={styles.fieldLabel}>{t('qDistHow')}</FieldLabelText>
										{/*
										 * **One card, and it is not a choice.** The frame offers a single
										 * distribution — everyone takes what they want from the map — so an
										 * `OptionGroup` of one would be a control that cannot be operated.
										 * It is drawn selected because it *is* the rule, and it is here at
										 * all because the rule is worth stating before the cap below it.
										 * "Eşit paylaştır" and "Sabit sıra" were drawn in the previous
										 * export and are gone from this one.
										 */}
										<CardSurface
											hasGlassSurface={false}
											style={[
												styles.selectedOption,
												{
													backgroundColor: theme.colors.accentSoft,
													borderColor: theme.colors.accent
												}
											]}
										>
											<BodyStrongText style={styles.selectedOptionTitle}>
												{t('qDistFree')}
											</BodyStrongText>
											<CaptionText color={theme.colors.subtext}>{t('qDistFreeHint')}</CaptionText>
										</CardSurface>

										{/*
										 * The cap is **optional and off by default**: its job is to stop one
										 * person taking twenty-nine cüz out of a group that has not filled
										 * yet, which is not most groups.
										 *
										 * **The switch and the number it governs are one card**, not two
										 * stacked ones. A stepper in a card of its own read as a second,
										 * unrelated setting — the thing it caps was in the card above it, and
										 * nothing tied the two together except being adjacent. `isFlush`
										 * because `ToggleRow` brings the padding; the stepper adds its own.
										 */}
										<CardSurface isFlush>
											<FormToggleRow
												hint={t('qMaxOptHint')}
												name='hasMaxPerMember'
												title={t('qMaxPer')}
											/>
											{/*
											 * The number the switch governs, revealed and hidden with the same
											 * motion — see `Collapsible` for why this is a height animation
											 * rather than an entering/exiting pair.
											 */}
											<Collapsible isOpen={hasMaxPerMember}>
												<View
													style={[
														styles.capDivider,
														{ backgroundColor: theme.colors.divider }
													]}
												/>
												<View style={styles.capBody}>
													{/*
													 * A plain 1…30 walk, unlike the seat stepper: seats must
													 * divide the hundred evenly, so that one steps through a
													 * list of three. A cap on holdings divides nothing — every
													 * number between one cüz and all thirty is a coherent
													 * answer.
													 */}
													<FormStepper
														caption={t('qCuzPerPerson')}
														name='maxPerMember'
														values={MAX_PER_MEMBER_VALUES}
													/>
													{/*
													 * The note belongs to the cap, so it lives in the cap's
													 * card. Outside it, it read as a footnote to the whole
													 * step — and it says nothing about distribution, which is
													 * the other thing on this screen.
													 */}
													<CaptionText color={theme.colors.faintText}>
														{t('qMaxNote')}
													</CaptionText>
												</View>
											</Collapsible>
										</CardSurface>
									</>
								) : null}

								{!createGroup.isPending && step === 3 && kind === 'CEVSEN' && !isPersonal ? (
									<>
										{/* Flexible has no seats to size, so the seat card goes with it. */}
										{isFlexible ? null : (
											<>
												<FieldLabelText style={styles.fieldLabel}>{t('spots')}</FieldLabelText>
												<CardSurface style={styles.spotsCard}>
													{/* The kind's own sizes: 5, 10 and 20 each divide the hundred
												    evenly, so +/- walk the list rather than adding a constant. */}
													<FormStepper
														caption={spotsCaption}
														name='spots'
														style={styles.stepper}
														values={SPOTS_FOR_KIND[kind]}
													/>
													{/* Every seat is a seat that will be filled — the grid shows the
												    capacity being chosen, not who has joined yet. */}
													{/* Sized for the largest option, so stepping 20 → 10 doesn't drop a
												    row out from under the plan options below it. */}
													<SpotsGrid
														columns={SPOTS_COLUMNS_FOR_KIND[kind]}
														filled={spots}
														maxTotal={MAX_SPOTS_FOR_KIND[kind]}
														total={spots}
													/>
												</CardSurface>
												<CaptionText color={theme.colors.faintText}>
													{t(SPOTS_NOTE_KEY_FOR_KIND[kind])}
												</CaptionText>
											</>
										)}
										{/*
										 * **The cadence lives here, above the plan, rather than on a step of
										 * its own.** It is two chips; a whole step for one control read as a
										 * page the flow had forgotten to fill, and it sat after the split it
										 * belongs with — how often the hundred is passed through, then how it
										 * is divided. The reminder that used to share that step had already
										 * gone (it is per account, not per group), which is what left it
										 * holding a single question.
										 */}
										<FieldLabelText style={styles.fieldLabel}>{t('cycle')}</FieldLabelText>
										<Select
											name='cycle'
											options={cycleOptionsFor(kind).map(option => ({
												label: t(cycleLabelKey(option)),
												value: option
											}))}
										/>
										<FieldLabelText style={styles.fieldLabel}>{t('readingPlan')}</FieldLabelText>
										<FormOptionGroup
											direction='column'
											name='splitMode'
											onChange={next => {
												if (next === 'FLEXIBLE') {
													setValue('visibility', 'OPEN', { shouldValidate: true });
												}
											}}
											options={[
												{
													hint: t('planRotationHint'),
													title: t('planRotation'),
													value: 'ROTATION'
												},
												{ hint: t('planFixedHint'), title: t('planFixed'), value: 'FIXED' },
												{
													hint: t('planFlexibleHint'),
													title: t('planFlexible'),
													value: 'FLEXIBLE'
												}
											]}
										/>
										{isFlexible ? (
											<BodyText color={theme.colors.subtext}>{t('flexiblePublicHint')}</BodyText>
										) : (
											<PlanPreview kind={kind} splitMode={watch('splitMode')} spots={spots} />
										)}
									</>
								) : null}

								{!createGroup.isPending && step === 3 && kind === 'HIZB' ? (
									<>
										<FieldLabelText>{t('hpPlan')}</FieldLabelText>
										<FormOptionGroup
											name='hizbPlan'
											onChange={() => setValue('hizbStartPortion', 1)}
											direction='column'
											options={(individual ? [7, 15, 32] : [7, 15, 32, 0]).map(days => ({
												value: String(days),
												title: days ? t('hpDays', { days }) : t('hpMixed'),
												hint: t(
													individual
														? 'hpIndividualPlanHint'
														: days
														? 'hpFixedHint'
														: 'hpMixedHint'
												)
											}))}
										/>
										<BodyText>{t('hpDailyHint')}</BodyText>
									</>
								) : null}

								{/* QC3 — how long a hatim's round runs, and what becomes of everyone's cüz at the end. */}
								{!createGroup.isPending && step === 4 && kind === 'HATIM' ? (
									<>
										<FieldLabelText style={styles.fieldLabel}>{t('qDurHow')}</FieldLabelText>
										{/*
										 * **The frame's Ramazan preset is deliberately absent.** It was thirty
										 * days starting whenever the group did, which is not Ramadan — and a
										 * group that wants Ramadan can be started on the first day and given
										 * the length it needs, which the custom stepper already does. A
										 * preset carrying the month's name while tracking nothing about the
										 * month would be the one option here that lies.
										 */}
										<View style={styles.durationRow}>
											{ROUND_DAYS_PRESETS.map(preset => (
												<CreateGroupDurationCard
													hint={`${preset} ${t(
														pluralKey(language, preset, 'qDaysOne', 'qDays')
													)}`}
													isSelected={roundDays === preset}
													key={preset}
													onPress={() =>
														setValue('roundDays', preset, { shouldValidate: true })
													}
													style={styles.durationCard}
													title={t(ROUND_DAYS_PRESET_KEYS[preset] ?? 'qCustom')}
												/>
											))}
										</View>
										{/*
										 * **"Özel" is selected by what the value *isn't*.** There is no mode
										 * flag: the stepper below is the real control and always live, so
										 * walking it off 7 or 30 is already choosing a custom length. This
										 * card says so, and tapping it moves the value somewhere custom for
										 * you — without it the two presets read as the only answers on offer.
										 *
										 * Full width rather than half: the frame's grid held four cards and
										 * dropping Ramazan leaves three, so a lone half-width card beside an
										 * empty cell would read as a missing option.
										 */}
										<CreateGroupDurationCard
											hint={t('qCustomHint')}
											isSelected={isCustomRoundLength}
											onPress={() =>
												setValue('roundDays', CUSTOM_ROUND_DAYS, { shouldValidate: true })
											}
											title={t('qCustom')}
										>
											{/*
											 * The number lives in the card that unlocks it, the way the cap's
											 * stepper lives in the switch's card. Below it instead, it read as
											 * a separate setting that happened to follow — and there was
											 * nothing on screen tying "gün / tur" to the card above.
											 */}
											<Collapsible isOpen={isCustomRoundLength}>
												<View
													style={[
														styles.capDivider,
														{ backgroundColor: theme.colors.divider }
													]}
												/>
												<View style={styles.capBody}>
													{/*
													 * **"gün sürer", not "gün / tur".** The stepper only ever
													 * appears under "Özel", and "per round" describes the thing
													 * this option is the absence of — a hatim that runs once for
													 * the days chosen and is then finished.
													 */}
													<FormStepper
														caption={t('qDaysTotal')}
														name='roundDays'
														values={ROUND_DAYS_VALUES}
													/>
													{/*
													 * Said outright rather than left to be inferred from a
													 * missing "Tur bitiminde" section below. "Özel" sits beside
													 * three cadences, so the reader's default reading is that
													 * it is a fourth — a rhythm they get to name.
													 */}
													<CaptionText color={theme.colors.faintText}>
														{t('qOnceNote')}
													</CaptionText>
												</View>
											</Collapsible>
										</CreateGroupDurationCard>
										{/*
										 * **What the chosen length actually comes to.** A stepper reading
										 * "10 gün / tur" is a duration; this is the date it lands on, which
										 * is the thing someone starting a Ramadan hatim or a group for a
										 * particular week is really choosing. Computed on the device
										 * because no group exists yet to ask the server about — see
										 * `roundEndPreview` for why that is safe here and nowhere else.
										 */}
										<CardSurface hasGlassSurface={false} style={styles.roundEndRow}>
											<Icon
												color={theme.colors.faintText}
												name='clock'
												size={15}
												strokeWidth={1.7}
											/>
											{/* A one-off ends the hatim, not a round. */}
											<CaptionText weight='semibold'>
												{t(isCustomRoundLength ? 'qEndsLabel' : 'qRoundEnds')}
											</CaptionText>
											<CaptionText
												color={theme.colors.subtext}
												style={styles.roundEndValue}
												textAlign='right'
											>
												{roundEndPreview(roundDays, language)}
											</CaptionText>
										</CardSurface>
										{/*
										 * **Nothing to decide for "Özel".** The presets are cadences — the
										 * hatim comes round again, and this says what happens to everyone's
										 * cüz when it does. "Özel" is a length: the hatim runs for the days
										 * chosen and is then finished, so there is no next round to keep
										 * them for or hand them back from.
										 */}
										{isCustomRoundLength ? null : (
											<>
												<FieldLabelText style={styles.fieldLabel}>{t('qAtEnd')}</FieldLabelText>
												<FormOptionGroup
													direction='column'
													name='boundaryPolicy'
													options={[
														{
															hint: t('qKeepCuzHint'),
															title: t('qKeepCuz'),
															value: 'KEEP'
														},
														{ hint: t('qRepickHint'), title: t('qRepick'), value: 'REPICK' }
													]}
												/>
											</>
										)}
									</>
								) : null}

								{/*
								 * QC4 — the creator takes their own cüz, before the group exists.
								 *
								 * **The frame's invite code and member list are deliberately absent.**
								 * Both describe a group that has already been created: there is no code
								 * to copy and nobody to list until the ✓ is pressed. They belong to the
								 * lobby, which is where this lands straight afterwards. What is left is
								 * the half that genuinely is a create-time decision — which cüz are
								 * yours — and the frame's title loses its "grubu paylaş" along with them.
								 */}
								{!createGroup.isPending && step === 5 && kind === 'HATIM' ? (
									<>
										<CaptionText color={theme.colors.subtext}>{t('qLobbySub')}</CaptionText>
										<CardSurface>
											{/*
											 * Nothing is taken yet — a group with one member has thirty free
											 * cüz — so the picker's "alındı" state cannot occur here. Passed
											 * empty rather than hidden, because the same component is what a
											 * joiner uses against a map that is mostly spoken for.
											 */}
											<CuzPicker
												maxSelectable={hasMaxPerMember ? watch('maxPerMember') : null}
												onToggle={toggleCuz}
												selectedNumbers={selectedCuz}
												takenNumbers={NO_TAKEN_CUZ}
											/>
											{/*
											 * The rule the ✓ is gated on, in the card it is a rule about —
											 * the same reasoning as the cap's note. Loose underneath, it
											 * read as a footnote to the step rather than as the condition
											 * on the grid directly above it.
											 */}
											<CaptionText color={theme.colors.faintText} style={styles.cardNote}>
												{t('qJoinNote')}
											</CaptionText>
										</CardSurface>
									</>
								) : null}

								{!createGroup.isPending && step === 4 && individual ? (
									<>
										<BodyText>{t('hpStartHint')}</BodyText>
										<FieldLabelText>{t('hpStartPortion')}</FieldLabelText>
										<FormStepper
											name='hizbStartPortion'
											values={Array.from(
												{ length: Number(watch('hizbPlan')) || 32 },
												(_, i) => i + 1
											)}
											// The group card's words: "15 gün · 1. gün · 1–3. bölüm" — "bölüm" is
											// only ever one of the 32, never the plan's own day.
											caption={startPortionCaption(
												Number(watch('hizbPlan')) || 32,
												Number(watch('hizbStartPortion')),
												t
											)}
										/>
										<BodyText>
											{t(
												hizbPlanDescriptionKey(
													Number(watch('hizbPlan')) || 32,
													watch('hizbStartPortion')
												)
											)}
										</BodyText>
										<CaptionText>{t('hpDailyHint')}</CaptionText>
									</>
								) : null}
								{!createGroup.isPending && step === 4 && kind === 'HIZB' && !individual ? (
									<>
										<BodyText>{t('hpBeginHint')}</BodyText>
										{/* One card, as in Yönet: the switch, and under it the days it counts. */}
										<CardSurface isFlush>
											<ToggleRow
												title={t('hpInactivity')}
												hint={t('hpInactivityHint')}
												value={watch('inactivityEnabled')}
												onValueChange={v => setValue('inactivityEnabled', v)}
											/>
											{watch('inactivityEnabled') ? (
												<>
													<Divider />
													<View style={styles.inactivityDays}>
														<FieldLabelText>{t('hpInactiveDays')}</FieldLabelText>
														<FormStepper
															name='inactivityDays'
															values={INACTIVITY_DAY_OPTIONS}
															caption={t('hpDays', { days: watch('inactivityDays') })}
														/>
													</View>
												</>
											) : null}
										</CardSurface>
									</>
								) : null}

								{/*
								 * **There is no fourth step for a Cevşen group.** The cadence moved up
								 * beside the split on step 3, and the reminder that once shared this
								 * step is per account rather than per group — `useReminderNotificationSync`
								 * schedules from `UserSettings` and sums what is owed across every
								 * running group, and nothing reads `Group.reminderEnabled` at all. So
								 * the step was left asking one question, then none. Hatırlatma owns the
								 * reminder, with its picker and its note about the first notification
								 * landing tomorrow; don't add a per-group one back here.
								 */}
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
	fieldLabel: {
		marginBottom: 0
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
	/**
	 * The card under a stepper — the seat picker with its lattice, and the two hatim steppers.
	 *
	 * It was a bare `View` with this padding and a note that the card had gone; it is back on
	 * request. A stepper is a number being *set*, and on the flat sheet it read as a number
	 * being stated — the ground is what says the ± belongs to the figure between them.
	 */
	spotsCard: {
		padding: 16
	},
	// Under a toggle row in a flush card: the row's own 15, so the stepper lines up under its title.
	inactivityDays: {
		gap: 12,
		padding: 15
	},
	/*
	 * **Step 1's own rhythm, on top of the container's 12** — HC1 opens the gap to about 20 under
	 * the sub line and 16 above the note. Added here rather than to `gap`, which every other
	 * step shares.
	 */
	kindCards: {
		marginTop: 8
	},
	// Glyph beside the text, both from the top: the note runs three lines and the glyph marks the first.
	kindNote: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 12
	},
	kindNoteCard: {
		marginTop: 4
	},
	// Centres the 17pt glyph on the body's 21pt first line.
	kindNoteIcon: {
		marginTop: 2
	},
	kindNoteText: {
		flex: 1
	},
	/** "Tur bitişi … 30 Eyl" — a row, not a section: the glyph, the label, the date at the end. */
	roundEndRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	/*
	 * **It shrinks, and it is right-aligned.** Without `flexShrink` the date keeps its full
	 * natural width, so a long one ("Tuesday, September 29, 2026") is broken at the last word
	 * that fits and the year is pushed onto a line nobody sees — leaving a row ending in a
	 * comma with empty space after it. Shrinking lets it wrap properly, and aligning right
	 * keeps both lines hanging off the same edge as the label opposite.
	 */
	roundEndValue: {
		flexShrink: 1,
		marginLeft: 'auto'
	},
	/**
	 * The gap the sheet's `gap` would give this block if it were always there — carried by
	 * the collapsing view instead, so it closes along with the height rather than leaving a
	 * hole where the stepper was.
	 */
	collapsedStepper: {
		paddingBottom: 12
	},
	/** A note that belongs to the control above it, inside the same card. */
	cardNote: {
		marginTop: 14
	},
	/** Separates the switch from the number it governs, inside the one card. */
	capDivider: {
		height: StyleSheet.hairlineWidth,
		marginHorizontal: 15
	},
	/** The stepper and its note, under the divider and inside the cap's own card. */
	capBody: {
		gap: 12,
		paddingBottom: 16,
		paddingHorizontal: 15,
		paddingTop: 14
	},
	/** QC2's single distribution card — drawn selected, because it is the rule, not a choice. */
	selectedOption: {
		borderRadius: 15,
		borderWidth: 1.5,
		padding: 14
	},
	selectedOptionTitle: {
		marginBottom: 4
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
	sheetColumn: {
		flex: 1
	},
	scroller: {
		flex: 1
	},
	sheetContent: {
		flexGrow: 1,
		gap: 12,
		paddingBottom: 8
	},
	durationRow: {
		flexDirection: 'row',
		gap: 9
	},
	/** Only the two presets share a row and divide it; "Özel" stands alone below them. */
	durationCard: {
		flex: 1
	},
	stepper: {
		marginBottom: 14
	}
});
