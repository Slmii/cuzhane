import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyText, TitleText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupDetail } from '@/lib/types/domain';
import { groupIntroductionSteps, groupIntroductionSummary } from '@/lib/utils/groupIntroduction';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = { group?: GroupDetail; initiallyExpanded?: boolean };

/** Always available to reread; opening help never changes reading progress. */
export const BeginnerGuide = ({ group, initiallyExpanded = false }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const [expanded, setExpanded] = useState(initiallyExpanded);
	const title = t(group ? 'introGuideTitle' : 'helpAppTitle');
	const steps = group
		? groupIntroductionSteps(group, group.isOwner ? 'created' : 'joined')
		: ([
				{ title: 'helpAppJoinTitle', body: 'helpAppJoin' },
				{ title: 'helpAppReadTitle', body: 'helpAppRead' },
				{ title: 'helpAppFinishTitle', body: 'helpAppFinish' }
		  ] as const);
	const values = {
		days: group?.hizbPlan ?? '',
		readAction: t('markRead'),
		openAction: t('hpRead'),
		finishAction: t('hpFinish'),
		joinAction: t('emptyMyJoin'),
		discoverAction: t('homeEmptyDiscoverTitle')
	};

	return (
		<CardSurface hasGlassSurface={false} isFlush style={styles.card}>
			<Pressable
				accessibilityRole='button'
				accessibilityLabel={`${title}. ${t(expanded ? 'helpHide' : 'helpShow')}`}
				accessibilityState={{ expanded }}
				onPress={() => setExpanded(value => !value)}
				style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.7 : 1 }]}
			>
				<View style={styles.heading}>
					<TitleText>{title}</TitleText>
					<BodyText color={theme.colors.accent} style={styles.copy}>
						{t(expanded ? 'helpHide' : 'helpShow')}
					</BodyText>
				</View>
				<Icon
					name='chevronRight'
					color={theme.colors.accent}
					size={20}
					style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}
				/>
			</Pressable>
			{expanded ? (
				<View style={styles.steps}>
					{group ? <BodyText style={styles.copy}>{t(groupIntroductionSummary(group))}</BodyText> : null}
					{steps.map((step, index) => (
						<View key={step.title} style={styles.step}>
							<BodyText style={styles.copy} weight='semibold'>{`${index + 1}. ${t(
								step.title
							)}`}</BodyText>
							<BodyText style={styles.copy}>{t(step.body, values)}</BodyText>
						</View>
					))}
				</View>
			) : null}
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	card: { marginTop: 12, marginBottom: 12 },
	toggle: { minHeight: 64, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
	heading: { flex: 1, gap: 4 },
	steps: { paddingHorizontal: 16, paddingBottom: 20, gap: 18 },
	step: { gap: 5 },
	copy: { fontSize: 16, lineHeight: 25 }
});
