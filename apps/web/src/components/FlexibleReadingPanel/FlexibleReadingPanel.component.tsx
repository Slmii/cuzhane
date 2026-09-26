import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import { CaptionText, TitleText } from '@/components/ui/Typography/Typography.component';
import { useGetPoolSlots, useReleasePoolPart, useTakePoolPart } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupDetail } from '@/lib/types/domain';
import { hizbPartsLabel } from '@/lib/utils/groups';
import { flexiblePortionState } from '@/lib/utils/flexible';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
	group: GroupDetail;
	onOpenReader: (number: number) => void;
};

/** Flexible groups share individual portions without assigning permanent seats. */
export const FlexibleReadingPanel = ({ group, onOpenReader }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const pool = useGetPoolSlots(group.id);
	const take = useTakePoolPart();
	const release = useReleasePoolPart();
	const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
	const parts = pool.data?.flatMap(slot => slot.parts) ?? [];
	const selected = parts.find(part => part.number === selectedNumber) ?? parts.find(part => !part.isRead) ?? parts[0];
	const state = selected ? flexiblePortionState(selected) : null;
	const busy = take.isPending || release.isPending;
	const label = (number: number) =>
		group.kind === 'HIZB' ? hizbPartsLabel(String(number), t) : `${t('bab')} ${number}`;
	const stateLabel = {
		available: t('flexibleAvailable'),
		mine: t('ownMine'),
		claimed: t('flexibleClaimed'),
		read: t('legendDone')
	};
	const palette = {
		available: { backgroundColor: theme.colors.poolFree, labelColor: theme.colors.sandText },
		mine: { backgroundColor: theme.colors.accentSoft, labelColor: theme.colors.accent },
		claimed: { backgroundColor: theme.colors.secondary, labelColor: theme.colors.subtext },
		read: { backgroundColor: theme.colors.babReadByMe, labelColor: theme.colors.onAccent }
	};

	return (
		<CardSurface>
			<TitleText>{t('flexibleChoose')}</TitleText>
			<CaptionText color={theme.colors.subtext} style={styles.hint}>
				{t('planFlexibleHint')}
			</CaptionText>
			{pool.isPending ? (
				<CaptionText>{t('loadingPool')}</CaptionText>
			) : pool.isError ? (
				<AppButton title={t('retry')} onPress={() => pool.refetch()} variant='surface' />
			) : (
				<>
					<CellGrid
						columns={group.kind === 'HIZB' ? 11 : 10}
						items={parts.map(part => {
							const partState = flexiblePortionState(part);
							return {
								key: part.number,
								label: part.number,
								...palette[partState],
								borderColor:
									part.number === selected?.number
										? theme.colors.text
										: palette[partState].backgroundColor,
								accessibilityLabel: `${label(part.number)} · ${stateLabel[partState]}`,
								isHatched: partState === 'available'
							};
						})}
						onPressCell={key => setSelectedNumber(Number(key))}
					/>
					{selected && state ? (
						<View style={styles.selection}>
							<CaptionText weight='semibold'>{`${label(selected.number)} · ${
								stateLabel[state]
							}`}</CaptionText>
							<View style={styles.actions}>
								{state === 'available' ? (
									<AppButton
										disabled={busy}
										title={t('flexibleTakeAndRead')}
										onPress={() =>
											take.mutate(
												{ groupId: group.id, babNumber: selected.number },
												{ onSuccess: () => onOpenReader(selected.number) }
											)
										}
									/>
								) : state === 'mine' ? (
									<>
										<AppButton
											disabled={busy}
											style={styles.action}
											title={t('read')}
											onPress={() => onOpenReader(selected.number)}
										/>
										<AppButton
											disabled={busy}
											style={styles.action}
											title={t('release')}
											variant='surface'
											onPress={() =>
												release.mutate({ groupId: group.id, babNumber: selected.number })
											}
										/>
									</>
								) : null}
							</View>
						</View>
					) : null}
					{take.isError || release.isError ? (
						<CaptionText color={theme.colors.danger}>{t('genericError')}</CaptionText>
					) : null}
				</>
			)}
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	action: { flex: 1 },
	actions: { flexDirection: 'row', gap: 8 },
	hint: { marginTop: 6, marginBottom: 14 },
	selection: { marginTop: 16, gap: 10 }
});
