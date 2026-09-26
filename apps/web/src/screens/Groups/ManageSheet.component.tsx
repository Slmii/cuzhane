import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Divider } from '@/components/ui/Divider/Divider.component';
import { Field } from '@/components/ui/Form/Field/Field.component';
import { Form } from '@/components/ui/Form/Form.component';
import { FormOptionGroup } from '@/components/ui/Form/OptionGroup/OptionGroup.component';
import { NavRow } from '@/components/ui/NavRow/NavRow.component';
import { ToggleRow } from '@/components/ui/ToggleRow/ToggleRow.component';
import { CaptionText, EyebrowText, FieldLabelText, Header2 } from '@/components/ui/Typography/Typography.component';
import { useDeleteGroup, useUpdateGroup } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { editGroupSchema, type EditGroupForm } from '@/lib/schemas/group.schema';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupDetail } from '@/lib/types/domain';
import { confirmDestructive } from '@/lib/utils/confirmDestructive';
import type { TabStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

type Props = {
	group: GroupDetail;
	isVisible: boolean;
	onClose: () => void;
	onOpenMembers: () => void;
};

/** How long the tick sits in its confirmed tone before offering to save again. */
const SAVED_RESET_MS = 1600;
/** Tall enough for the details form and the rows under it; the body scrolls inside it. */
const SHEET_HEIGHT_RATIO = 0.82;

export const ManageSheet = ({ group, isVisible, onClose, onOpenMembers }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const navigation = useNavigation<NativeStackNavigationProp<TabStackParamList>>();

	const updateGroup = useUpdateGroup();
	const deleteGroup = useDeleteGroup();
	const schema = useMemo(() => editGroupSchema(t), [t]);

	const [isSaved, setIsSaved] = useState(false);
	const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (savedTimeoutRef.current) {
				clearTimeout(savedTimeoutRef.current);
			}
		},
		[]
	);

	const handleSave = (values: EditGroupForm) => {
		updateGroup.mutate({
			// Blank is "no intention", which the API stores as null rather than an empty string.
			dedication: values.dedication.trim() === '' ? null : values.dedication.trim(),
			groupId: group.id,
			name: values.name.trim(),
			visibility: group.splitMode === 'FLEXIBLE' && group.hizbPlan == null ? 'OPEN' : values.visibility
		});

		setIsSaved(true);

		if (savedTimeoutRef.current) {
			clearTimeout(savedTimeoutRef.current);
		}

		savedTimeoutRef.current = setTimeout(() => setIsSaved(false), SAVED_RESET_MS);
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
					name: group.name,
					visibility: group.visibility
				}}
				key={isVisible ? 'open' : 'closed'}
				render={({ handleSubmit }) => (
					<>
						{/*
						 * Destroy on the left, keep on the right — create-group's × / ✓ pair, in the
						 * corners where a sheet's decisions live. Both are icon-only `AppButton`s,
						 * which is the navigation bar's 44pt disc; the tick goes quiet for a moment
						 * once it lands, since a glyph has no label to turn into "Kaydedildi".
						 */}
						<View style={styles.controls}>
							<AppButton
								accessibilityLabel={t('deleteGroup')}
								disabled={deleteGroup.isPending}
								fullWidth={false}
								icon='delete'
								onPress={handleDelete}
								variant='dangerFilled'
							/>
							<AppButton
								accessibilityLabel={isSaved ? t('saved') : t('save')}
								disabled={updateGroup.isPending}
								fullWidth={false}
								icon='check'
								onPress={handleSubmit(handleSave)}
								variant={isSaved ? 'surface' : 'accent'}
							/>
						</View>
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
								<Field label={t('dedication')} name='dedication' placeholder={t('dedicationHint')} />
								{group.hizbIndividual ? (
									<CaptionText>{t('hpIndividualPrivacy')}</CaptionText>
								) : isFlexible ? (
									<CaptionText>{t('flexiblePublicHint')}</CaptionText>
								) : (
									<>
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
								)}
							</View>

							{/* Who may come in, and who already has: switches that mean something the
							    moment they are touched, so they save on the spot rather than waiting
							    for the tick above. */}
							{!group.hizbIndividual ? (
								<>
									<EyebrowText color={theme.colors.faintText} style={styles.sectionLabel}>
										{t('groupAccess')}
									</EyebrowText>
									<View style={styles.card}>
										<ToggleRow
											title={t('hideMemberNames')}
											hint={t('hideMemberNamesHint')}
											value={group.hideMemberNames}
											disabled={updateGroup.isPending}
											onValueChange={next =>
												updateGroup.mutate({ groupId: group.id, hideMemberNames: next })
											}
										/>
										<Divider />
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
											onPress={onOpenMembers}
										/>
									</View>
								</>
							) : null}
						</ScrollView>
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
	form: {
		gap: 12,
		marginBottom: 22
	},
	scroller: {
		flex: 1
	},
	/** The heading is the eyebrow's, not the field's — hence the room under it. */
	sectionLabel: {
		marginBottom: 20
	},
	title: {
		fontSize: 21,
		marginBottom: 14
	}
});
