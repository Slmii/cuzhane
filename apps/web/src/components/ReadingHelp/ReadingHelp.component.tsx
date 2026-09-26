import { StyleSheet, View } from 'react-native';
import type { HelpTarget, ReadingHelp, HelpAction } from '@/api/readingHelp.api';
import { useReadingHelp, useRequestReadingHelp, useActOnReadingHelp } from '@/lib/hooks/useReadingHelp';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { BodyText, CaptionText, TitleText } from '@/components/ui/Typography/Typography.component';

export const RequestHelpButton = ({
	groupId,
	target,
	today = false
}: {
	groupId: string;
	target: HelpTarget;
	today?: boolean;
}) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const query = useReadingHelp(groupId);
	const request = useRequestReadingHelp(groupId);
	const existing = query.data?.find(
		r =>
			r.mine &&
			('assignmentId' in target
				? r.assignmentId === target.assignmentId
				: r.roundIndex === target.roundIndex && !r.completed)
	);
	return (
		<View style={styles.actions}>
			{existing ? (
				<CaptionText color={theme.colors.accent}>
					{t(existing.completed ? 'helpCompleted' : existing.claimed ? 'helpClaimed' : 'helpRequested')}
				</CaptionText>
			) : (
				<AppButton
					title={t(today ? 'helpToday' : 'helpRequest')}
					variant='surface'
					isLoading={request.isPending}
					onPress={() => {
						if (!request.isPending) {
							request.mutate(target);
						}
					}}
				/>
			)}
			{request.isError ? <CaptionText color={theme.colors.danger}>{t('helpError')}</CaptionText> : null}
		</View>
	);
};

export const ReadingHelpPanel = ({
	groupId,
	onOpen,
	onMissed
}: {
	groupId: string;
	onOpen: (request: ReadingHelp) => void;
	onMissed?: () => void;
}) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const query = useReadingHelp(groupId);
	const update = useActOnReadingHelp(groupId);
	const requests = query.data ?? [];
	const act = (r: ReadingHelp, action: HelpAction) => {
		if (!update.isPending) {
			update.mutate({ id: r.id, version: r.version, action });
		}
	};
	return (
		<CardSurface style={styles.panel}>
			<TitleText>{t('helpTitle')}</TitleText>
			<CaptionText color={theme.colors.subtext}>{t('helpHint')}</CaptionText>
			{onMissed ? <AppButton title={t('helpMissed')} variant='surface' onPress={onMissed} /> : null}
			{query.isError ? (
				<>
					<CaptionText color={theme.colors.danger}>{t('helpError')}</CaptionText>
					<AppButton title={t('retry')} variant='surface' onPress={() => void query.refetch()} />
				</>
			) : null}
			{query.isLoading ? <CaptionText>{t('helpLoading')}</CaptionText> : null}
			{!query.isLoading && !query.isError && !requests.length ? (
				<CaptionText color={theme.colors.subtext}>{t('helpEmpty')}</CaptionText>
			) : null}
			{requests.map(r => (
				<View key={r.id} style={[styles.request, { borderTopColor: theme.colors.divider }]}>
					<BodyText weight='semibold'>{r.mine ? t('you') : r.requesterName ?? t('anonymousMember')}</BodyText>
					<CaptionText>
						{r.assignmentId
							? `${r.date} · ${t('hpPortion', { days: r.planDays!, portion: r.portion! })}`
							: `${t('roundN')} ${(r.roundIndex ?? 0) + 1} · ${t(
									r.kind === 'HIZB' ? 'portions' : 'babs'
							  )} ${r.babNumbers.join(', ')}`}
					</CaptionText>
					<CaptionText color={r.completed ? theme.colors.accent : theme.colors.subtext}>
						{r.completed ? `✓ ${t('helpCompleted')}` : t(r.claimed ? 'helpClaimed' : 'helpRequested')}
					</CaptionText>
					{!r.completed ? (
						<View style={styles.actions}>
							{r.mine ? (
								<AppButton
									title={t('helpCancel')}
									variant='ghost'
									disabled={update.isPending}
									onPress={() => act(r, 'cancel')}
								/>
							) : null}
							{!r.mine && !r.claimed ? (
								<AppButton
									title={t('helpTake')}
									variant='surface'
									disabled={update.isPending}
									onPress={() => act(r, 'claim')}
								/>
							) : null}
							{r.takenByMe ? (
								<>
									<AppButton
										title={t('helpRead')}
										disabled={update.isPending}
										onPress={() => onOpen(r)}
									/>
									<AppButton
										title={t('helpFinish')}
										variant='surface'
										disabled={update.isPending}
										onPress={() => act(r, 'complete')}
									/>
									<CaptionText color={theme.colors.subtext}>{t('helpFinishHint')}</CaptionText>
									<AppButton
										title={t('helpRelease')}
										variant='ghost'
										disabled={update.isPending}
										onPress={() => act(r, 'release')}
									/>
								</>
							) : null}
						</View>
					) : null}
				</View>
			))}
			{update.isError ? <CaptionText color={theme.colors.danger}>{t('helpError')}</CaptionText> : null}
		</CardSurface>
	);
};
const styles = StyleSheet.create({
	panel: { gap: 12 },
	actions: { gap: 8 },
	request: { gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth }
});
