import { Icon } from '@/components/ui/Icon/Icon.component';
import { SearchBox } from '@/components/ui/SearchBox/SearchBox.component';
import { SearchInput } from '@/components/ui/SearchInput/SearchInput.component';
import { CaptionText, Header2 } from '@/components/ui/Typography/Typography.component';
import { useUpdateGroup } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import type { GroupDetail, GroupMember } from '@/lib/types/domain';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';

/** At most this many are responsible. Mirrors `MAX_READER_SEERS` on the server. */
const MAX_SEERS = 3;

/**
 * "Sorumlular" — Yönet's second page, in the same sheet: who is responsible in a shared Hizb plan,
 * the owner's choice of up to three (the owner ticked by default, and free to untick). Each tap
 * saves on the spot, like the switch it belongs to.
 *
 * **Windowed and searched**: a plan group has no member limit, so the list can run to hundreds.
 * The heading and the search travel as the list's header.
 */
export const ReaderSeersPicker = ({ group }: { group: GroupDetail }) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const updateGroup = useUpdateGroup();
	const [search, setSearch] = useState('');
	const members = group.members;
	// While a change is saving, show it rather than the group's last answer.
	const pendingSeers = updateGroup.isPending ? updateGroup.variables?.readerSeerUserIds : undefined;
	const seers = useMemo(
		() => pendingSeers ?? members.filter(member => member.seesReaders).map(member => member.userId),
		[members, pendingSeers]
	);
	const isFull = seers.length >= MAX_SEERS;

	// The ticked first, then everyone by name — and the search narrows the rest, never the ticked.
	const list = useMemo(() => {
		const needle = search.trim().toLocaleLowerCase(language);
		const byName = (a: GroupMember, b: GroupMember) => a.displayName.localeCompare(b.displayName, language);

		return [
			...members.filter(member => seers.includes(member.userId)).sort(byName),
			...members
				.filter(member => !seers.includes(member.userId))
				.filter(member => needle === '' || member.displayName.toLocaleLowerCase(language).includes(needle))
				.sort(byName)
		];
	}, [language, members, search, seers]);

	const toggle = (userId: string) =>
		updateGroup.mutate({
			groupId: group.id,
			readerSeerUserIds: seers.includes(userId) ? seers.filter(id => id !== userId) : [...seers, userId]
		});

	const header = (
		<View>
			<Header2 style={styles.title}>{t('hpSeersTitle')}</Header2>
			<CaptionText color={theme.colors.subtext}>{t('hpSeersHint')}</CaptionText>
			{isFull ? (
				<CaptionText color={theme.colors.subtext} style={styles.note}>
					{t('hpSeersFull')}
				</CaptionText>
			) : null}
			{/* iOS: the glass pill every search box there is; Android keeps the frame's flat box. */}
			{Platform.OS === 'ios' ? (
				<SearchBox
					onChangeText={setSearch}
					onClear={() => setSearch('')}
					placeholder={t('hpSeersSearch')}
					style={styles.search}
					value={search}
				/>
			) : (
				<View
					style={[
						styles.search,
						styles.searchBox,
						{ backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }
					]}
				>
					<Icon color={theme.colors.faintText} name='search' size={15} strokeWidth={1.8} />
					<SearchInput
						fontSize={12.5}
						onChangeText={setSearch}
						placeholder={t('hpSeersSearch')}
						style={styles.searchInput}
						value={search}
					/>
				</View>
			)}
		</View>
	);

	return (
		<FlatList
			contentContainerStyle={styles.listContent}
			data={list}
			initialNumToRender={14}
			keyboardShouldPersistTaps='handled'
			keyExtractor={member => member.userId}
			ListHeaderComponent={header}
			maxToRenderPerBatch={14}
			renderItem={({ index, item: member }) => {
				const isTicked = seers.includes(member.userId);
				const isDisabled = updateGroup.isPending || (!isTicked && isFull);
				const name = member.role === 'OWNER' ? `${member.displayName} · ${t('hpYou')}` : member.displayName;

				return (
					<Pressable
						accessibilityLabel={name}
						accessibilityRole='checkbox'
						accessibilityState={{ checked: isTicked, disabled: isDisabled }}
						disabled={isDisabled}
						onPress={() => toggle(member.userId)}
						style={({ pressed }) => [
							styles.row,
							{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
							index === 0
								? [styles.rowFirst, { borderTopColor: theme.colors.border }]
								: { borderTopColor: theme.colors.divider },
							index === list.length - 1 ? styles.rowLast : null,
							{ opacity: !isTicked && isFull ? 0.5 : pressed ? 0.8 : 1 }
						]}
					>
						<View style={[styles.avatar, { backgroundColor: theme.colors.accentSoft }]}>
							<CaptionText color={theme.colors.accent} style={styles.avatarLabel} weight='semibold'>
								{member.displayName.charAt(0).toLocaleUpperCase(language)}
							</CaptionText>
						</View>
						<CaptionText numberOfLines={1} style={styles.name} weight='semibold'>
							{name}
						</CaptionText>
						<View
							style={[
								styles.box,
								{
									backgroundColor: isTicked ? theme.colors.accent : theme.colors.transparent,
									borderColor: isTicked ? theme.colors.accent : toAlphaColor(theme.colors.text, 0.3),
									borderWidth: isTicked ? 0 : 1.5
								}
							]}
						>
							{isTicked ? (
								<Icon color={theme.colors.onAccent} name='check' size={14} strokeWidth={2.4} />
							) : null}
						</View>
					</Pressable>
				);
			}}
			showsVerticalScrollIndicator={false}
			style={styles.list}
			windowSize={9}
		/>
	);
};

/* The readers list's measures (T5); the heading is Yönet's own. */
const styles = StyleSheet.create({
	list: { flex: 1 },
	listContent: { paddingBottom: 20 },
	title: { fontSize: 21, marginBottom: 4 },
	note: { fontSize: 11.5, lineHeight: 16.7, marginTop: 10 },
	search: { marginBottom: 12, marginTop: 12 },
	searchBox: {
		alignItems: 'center',
		borderRadius: 12,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 13,
		paddingVertical: 11
	},
	searchInput: { flex: 1 },
	row: {
		alignItems: 'center',
		borderLeftWidth: StyleSheet.hairlineWidth,
		borderRightWidth: StyleSheet.hairlineWidth,
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 11
	},
	rowFirst: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
	rowLast: { borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderBottomWidth: StyleSheet.hairlineWidth },
	avatar: { alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
	avatarLabel: { fontSize: 12 },
	name: { flex: 1, fontSize: 12.5, minWidth: 0 },
	box: { alignItems: 'center', borderRadius: 7, height: 22, justifyContent: 'center', width: 22 }
});
