import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TabStackParamList } from '@/navigation/types';
import type { ReadingCadence } from '@/api/readingGroups.api';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { AppInput } from '@/components/ui/Input/Input.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { BodyStrongText, CaptionText } from '@/components/ui/Typography/Typography.component';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl.component';
import { useCreateReadingGroup, useJoinReadingGroup, useReadingGroups } from '@/lib/hooks/useReadingGroups';
import { useTranslation } from '@/lib/i18n/I18n.context';

type Props = NativeStackScreenProps<TabStackParamList, 'HizbGroups'>;
export const HizbGroupsScreen = ({ navigation }: Props) => {
	const { t } = useTranslation();
	const groups = useReadingGroups();
	const create = useCreateReadingGroup();
	const join = useJoinReadingGroup();
	const [mode, setMode] = useState<'create' | 'join' | null>(null);
	const [name, setName] = useState('');
	const [code, setCode] = useState('');
	const [cadence, setCadence] = useState<ReadingCadence>('WEEKLY');
	const busy = create.isPending || join.isPending;
	const open = (id: string) => navigation.navigate('HizbGroup', { groupId: id });
	return (
		<ScreenContainer>
			<ScreenHeader hasBackButton title={t('hrGroups')} subtitle={t('hrIntro')} />
			<View style={styles.actions}>
				<AppButton
					style={styles.flex}
					title={t('hrCreate')}
					variant={mode === 'create' ? 'primary' : 'surface'}
					onPress={() => {
						setMode('create');
						create.reset();
						join.reset();
					}}
				/>
				<AppButton
					style={styles.flex}
					title={t('hrJoin')}
					variant={mode === 'join' ? 'primary' : 'surface'}
					onPress={() => {
						setMode('join');
						create.reset();
						join.reset();
					}}
				/>
			</View>
			{mode === 'create' ? (
				<CardSurface style={{ gap: 10 }}>
					<AppInput
						accessibilityLabel={t('hrName')}
						label={t('hrName')}
						value={name}
						onChangeText={setName}
						maxLength={60}
					/>
					<SegmentedControl
						value={cadence}
						onChange={value => setCadence(value as ReadingCadence)}
						options={[
							{ label: t('hrWeekly'), value: 'WEEKLY' },
							{ label: t('hrMonthly'), value: 'MONTHLY' }
						]}
					/>
					<CaptionText>{t('hrSchedule')}</CaptionText>
					<AppButton
						title={t('hrCreate')}
						disabled={!name.trim() || busy}
						isLoading={create.isPending}
						onPress={() =>
							create.mutate(
								{
									name: name.trim(),
									cadence,
									timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
								},
								{
									onSuccess: group => {
										setMode(null);
										setName('');
										open(group.id);
									}
								}
							)
						}
					/>
				</CardSurface>
			) : null}
			{mode === 'join' ? (
				<CardSurface style={{ gap: 10 }}>
					<AppInput
						accessibilityLabel={t('hrCode')}
						label={t('hrCode')}
						value={code}
						onChangeText={setCode}
						autoCapitalize='characters'
						autoCorrect={false}
						maxLength={32}
					/>
					<AppButton
						title={t('hrJoin')}
						disabled={code.replace(/[^a-z2-9]/gi, '').length !== 8 || busy}
						isLoading={join.isPending}
						onPress={() =>
							join.mutate(code, {
								onSuccess: group => {
									setMode(null);
									setCode('');
									open(group.id);
								}
							})
						}
					/>
				</CardSurface>
			) : null}
			{create.isError || join.isError ? <CaptionText>{t('hrError')}</CaptionText> : null}
			{groups.isPending ? <ActivityIndicator accessibilityLabel={t('hrLoading')} /> : null}
			{groups.isError ? <AppButton title={t('retry')} onPress={() => void groups.refetch()} /> : null}
			{groups.data?.length === 0 ? <CaptionText>{t('hrEmpty')}</CaptionText> : null}
			{groups.data?.map(group => (
				<Pressable key={group.id} accessibilityRole='button' onPress={() => open(group.id)}>
					<CardSurface style={{ gap: 10 }}>
						<BodyStrongText>{group.name}</BodyStrongText>
						<CaptionText>{t(group.cadence === 'WEEKLY' ? 'hrWeekly' : 'hrMonthly')}</CaptionText>
						{!group.memberships.some(m => m.active) ? <CaptionText>{t('hrFormer')}</CaptionText> : null}
					</CardSurface>
				</Pressable>
			))}
		</ScreenContainer>
	);
};
const styles = StyleSheet.create({ actions: { flexDirection: 'row', gap: 8 }, flex: { flex: 1 } });
