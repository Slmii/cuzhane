import { AssignmentBanner } from '@/components/AssignmentBanner/AssignmentBanner.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { CodeInput } from '@/components/ui/CodeInput/CodeInput.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import {
	CaptionText,
	Header2,
	Header3,
	MonoText,
	StatText,
	TitleText,
	Typography
} from '@/components/ui/Typography/Typography.component';
import { useJoinGroupByCode, useLookupGroupByCode } from '@/lib/hooks/useMembership';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { cycleLabelKey } from '@/lib/utils/groups';
import { formatInviteCode } from '@/lib/utils/inviteCode';
import type { TabStackParamList } from '@/navigation/types';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { JoinByCodeSheetProps } from './JoinByCodeSheet.types';

type Step = 'code' | 'preview' | 'full' | 'notfound';

const CODE_LENGTH = 8;
const PASTED_LABEL_DURATION_MS = 1600;
/** The design's invite grid is ten wide, however many seats the group has. */
const SEAT_COLUMNS = 10;

const normalizeCode = (input: string) =>
	input
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.slice(0, CODE_LENGTH);

/**
 * Joining with an invite code, start to finish, in one sheet.
 *
 * The three states used to be three pushed screens (01a/01b/01c). They became steps here
 * because an invitation is now a code and nothing else: there is no link to land on, so
 * there was no longer anything to *navigate to* — you open the sheet from wherever you
 * are, and it either finds the group or it doesn't. Keeping it as one surface also keeps
 * the typed code alive across "Geri", which a popped screen could not.
 */
export const JoinByCodeSheet = ({ isVisible, onClose }: JoinByCodeSheetProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const navigation = useNavigation<NativeStackNavigationProp<TabStackParamList>>();
	// Typed off the component rather than React Native's `TextInput`: `BottomSheetTextInput`
	// forwards to gesture-handler's re-typed input, and the two aren't assignable.
	const inputRef = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);

	const [step, setStep] = useState<Step>('code');
	const [code, setCode] = useState('');
	const [isPasted, setIsPasted] = useState(false);

	const lookup = useLookupGroupByCode();
	const joinByCode = useJoinGroupByCode();

	const handleClose = () => {
		setStep('code');
		setCode('');
		// Or reopening the sheet would show the last group found, under a fresh empty field.
		lookup.reset();
		onClose();
	};

	const handleChangeText = (text: string) => {
		setCode(normalizeCode(text));
	};

	const handlePaste = async () => {
		const normalized = normalizeCode(await Clipboard.getStringAsync());

		if (!normalized) {
			return;
		}

		setCode(normalized);
		setIsPasted(true);
		setTimeout(() => setIsPasted(false), PASTED_LABEL_DURATION_MS);
	};

	const handleFindGroup = async () => {
		if (code.length !== CODE_LENGTH) {
			return;
		}

		try {
			const found = await lookup.mutateAsync(code);

			// A full group gets the dead-end state rather than a join button it can't honour —
			// the same branch the standalone 01c screen used to be.
			setStep(found.isFull ? 'full' : 'preview');
		} catch {
			// A whole step, not a red line under the field. A code that finds nothing is the
			// end of this attempt — it needs to say what probably went wrong and offer the two
			// ways forward, which a one-line banner under eight cells cannot. Every failure
			// lands here, because from the reader's side "the server is down" and "that code
			// isn't a group" are the same sentence: this code got you nowhere.
			setStep('notfound');
		}
	};

	const handleJoin = async () => {
		const joined = await joinByCode.mutateAsync(code);

		handleClose();
		navigation.navigate('JoinedWelcome', { groupId: joined.id });
	};

	const handleDiscover = () => {
		handleClose();
		navigation.navigate('Tabs', { screen: 'Discover' });
	};

	const data = lookup.data;
	// Memoised for the same reason as every other grid's cells: `CellGrid` keeps a cell only
	// while the item it was handed keeps its identity, and this sheet re-renders on every
	// keystroke of the code above.
	const seats = useMemo<CellGridItem[]>(
		() =>
			Array.from({ length: data?.spots ?? 0 }, (_, index) => ({
				backgroundColor: theme.colors.accent,
				key: index
			})),
		[data?.spots, theme]
	);

	// Sized to its content like every other sheet in the app, not pinned to a detent. The
	// three steps are short — eight cells and a button, a card, a grid — so a fixed
	// full-height sheet left a screenful of dead space under the code entry and pushed
	// "Grubu bul" to the bottom of the phone, miles from the thing it acts on.
	return (
		<AppBottomSheet isVisible={isVisible} onClose={handleClose}>
			<View>
				<Header2 style={styles.title}>
					{step === 'full' ? t('groupFull') : step === 'notfound' ? t('notFoundTitle') : t('joinTitle')}
				</Header2>

				{step === 'code' ? (
					<View>
						<CaptionText color={theme.colors.subtext} style={styles.intro}>
							{t('joinSub')}
						</CaptionText>
						<View style={styles.codeWrap}>
							<CodeInput onPress={() => inputRef.current?.focus()} value={code} />
							<BottomSheetTextInput
								autoCapitalize='characters'
								autoCorrect={false}
								maxLength={CODE_LENGTH}
								onChangeText={handleChangeText}
								ref={inputRef}
								style={styles.hiddenInput}
								value={code}
							/>
						</View>
						<AppButton
							{...(isPasted ? { icon: 'check' as const } : {})}
							onPress={() => void handlePaste()}
							size='md'
							style={styles.paste}
							title={isPasted ? t('pasted') : t('paste')}
							variant='surface'
						/>
						<AppButton
							disabled={code.length !== CODE_LENGTH}
							isLoading={lookup.isPending}
							onPress={() => void handleFindGroup()}
							style={styles.primary}
							title={t('findGroup')}
						/>
					</View>
				) : step === 'preview' && data ? (
					<View>
						<CaptionText color={theme.colors.subtext} style={styles.intro}>
							{t('linkTitle', { group: data.name })}
						</CaptionText>

						<CardSurface style={styles.card}>
							<View style={styles.cardHead}>
								<View style={styles.cardHeadCopy}>
									<Header3 style={styles.cardName}>{data.name}</Header3>
									{data.dedication ? (
										<CaptionText color={theme.colors.faintText}>
											{t('forName', { dedication: data.dedication })}
										</CaptionText>
									) : null}
								</View>
								<Chip label={t(data.visibility === 'OPEN' ? 'open' : 'private')} tone='accent' />
							</View>

							<View style={styles.countRow}>
								<Typography color={theme.colors.accent} style={styles.count} variant='numeric'>
									{data.readCount}
								</Typography>
								<CaptionText color={theme.colors.faintText}>{`/ 100 ${t('babs')}`}</CaptionText>
							</View>
							<ProgressBar percent={data.percent} style={styles.bar} />

							{/* Two facts, not four: who is in it and how often it turns over. The
							    stats the standalone screen carried belong to Keşfet, where you
							    are comparing groups — here you already know which one you mean. */}
							<View style={[styles.statGrid, { borderTopColor: theme.colors.borderStrong }]}>
								<View style={styles.stat}>
									<Typography style={styles.statValue} variant='title'>
										{`${data.memberCount} / ${data.spots}`}
									</Typography>
									<StatText color={theme.colors.faintText}>{t('members')}</StatText>
								</View>
								<View style={styles.stat}>
									<Typography style={styles.statValue} variant='title'>
										{t(cycleLabelKey(data.cycle))}
									</Typography>
									<StatText color={theme.colors.faintText}>{t('cycle')}</StatText>
								</View>
							</View>
						</CardSurface>

						{/* The promise the code is making. Only when there is a seat to promise —
						    a group can fill between the code being shared and typed. */}
						{data.nextRange ? (
							<AssignmentBanner
								description={t('autoAssign')}
								label={t('youllGet')}
								range={`${data.nextRange.start}–${data.nextRange.end}`}
								style={styles.assignment}
							/>
						) : null}

						<AppButton
							isLoading={joinByCode.isPending}
							onPress={() => void handleJoin()}
							style={styles.primary}
							title={t('joinNow')}
						/>
						<AppButton
							onPress={() => setStep('code')}
							style={styles.secondary}
							title={t('back')}
							variant='ghost'
						/>
					</View>
				) : step === 'notfound' ? (
					<View>
						<CaptionText color={theme.colors.subtext} style={styles.intro}>
							{t('notFoundHint')}
						</CaptionText>

						<View style={styles.notFoundMark}>
							<View style={[styles.notFoundGlyph, { backgroundColor: theme.colors.dangerSurface }]}>
								<Icon color={theme.colors.danger} name='searchOff' size={26} strokeWidth={1.7} />
							</View>
							{/* The code they actually typed, given back to them — half of "check it
							    again" is being able to see what you sent. Dashed and tracked out so
							    it reads a character at a time, which is the point. */}
							<MonoText color={theme.colors.faintText} style={styles.notFoundCode}>
								{formatInviteCode(code)}
							</MonoText>
						</View>

						<AppButton onPress={() => setStep('code')} style={styles.primary} title={t('fixCode')} />
						<AppButton
							onPress={handleDiscover}
							size='md'
							style={styles.secondary}
							title={t('browseOpen')}
							variant='surface'
						/>
					</View>
				) : data ? (
					<View>
						<CaptionText color={theme.colors.subtext} style={styles.intro}>
							{t('groupFullHint')}
						</CaptionText>

						<CardSurface style={styles.card}>
							<View style={styles.fullHead}>
								<TitleText>{data.name}</TitleText>
								<Chip label={`${data.spots} / ${data.spots}`} tone='neutral' />
							</View>
							{/* Seats drawn full rather than counted: a solid block of them settles
							    the question in a way the number "25 / 25" invites argument about. */}
							<CellGrid columns={SEAT_COLUMNS} gap={3} items={seats} radius={4} />
						</CardSurface>

						<AppButton onPress={handleDiscover} style={styles.primary} title={t('discover')} />
						<AppButton
							onPress={() => setStep('code')}
							style={styles.secondary}
							title={t('back')}
							variant='ghost'
						/>
					</View>
				) : null}
			</View>
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	assignment: {
		marginBottom: 16
	},
	bar: {
		marginBottom: 14
	},
	card: {
		marginBottom: 10,
		padding: 16
	},
	cardHead: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		marginBottom: 12
	},
	cardHeadCopy: {
		flex: 1,
		gap: 4
	},
	cardName: {
		lineHeight: 22
	},
	codeWrap: {
		position: 'relative'
	},
	count: {
		fontSize: 23,
		lineHeight: 27
	},
	countRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 7,
		marginBottom: 8
	},
	notFoundCode: {
		fontSize: 11,
		letterSpacing: 1.54,
		marginTop: 16
	},
	notFoundGlyph: {
		alignItems: 'center',
		borderRadius: 30,
		height: 60,
		justifyContent: 'center',
		width: 60
	},
	notFoundMark: {
		alignItems: 'center',
		paddingBottom: 4,
		paddingTop: 10
	},
	fullHead: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		marginBottom: 12
	},
	hiddenInput: {
		height: '100%',
		left: 0,
		opacity: 0,
		pointerEvents: 'none',
		position: 'absolute',
		top: 0,
		width: '100%'
	},
	intro: {
		marginBottom: 16,
		marginTop: 6
	},
	paste: {
		marginTop: 14
	},
	// Follows whatever is above it now that the sheet hugs its content — the extra top
	// margin is the gap the design leaves between a step's body and its commit.
	primary: {
		marginTop: 14
	},
	secondary: {
		marginTop: 8
	},
	stat: {
		flex: 1,
		gap: 2
	},
	statGrid: {
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 10,
		paddingTop: 12
	},
	statValue: {
		fontSize: 14,
		lineHeight: 19
	},
	title: {
		fontSize: 24,
		lineHeight: 29
	}
});
