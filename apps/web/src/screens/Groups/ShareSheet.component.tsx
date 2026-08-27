import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupDetail } from '@/lib/types/domain';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

type Props = {
	group: GroupDetail;
	isVisible: boolean;
	onClose: () => void;
};

const COPIED_RESET_MS = 1600;

/**
 * The invite, and the whole of it. There is no shareable URL any more — no link to send,
 * no QR square standing in for one — so the code isn't a detail beside the real thing, it
 * *is* the thing, and the sheet sets it as the hero at 34pt with the copy button under it.
 */
export const ShareSheet = ({ group, isVisible, onClose }: Props) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	const [isCopied, setIsCopied] = useState(false);
	const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (copyTimeoutRef.current) {
				clearTimeout(copyTimeoutRef.current);
			}
		},
		[]
	);

	const handleCopyCode = async () => {
		if (!group.inviteCode) {
			return;
		}

		// The dash is display only — what lands on the clipboard is what the join sheet
		// accepts, so a pasted code needs no cleaning up at the other end.
		await Clipboard.setStringAsync(group.inviteCode.replace(/-/g, ''));
		setIsCopied(true);

		if (copyTimeoutRef.current) {
			clearTimeout(copyTimeoutRef.current);
		}

		copyTimeoutRef.current = setTimeout(() => setIsCopied(false), COPIED_RESET_MS);
	};

	return (
		<AppBottomSheet description={t('shareHint')} isVisible={isVisible} onClose={onClose} title={t('shareTitle')}>
			<CardSurface style={styles.card}>
				{group.inviteCode ? (
					<>
						<EyebrowText color={theme.colors.faintText}>{t('inviteCode')}</EyebrowText>
						<Typography color={theme.colors.accent} style={styles.code} variant='header1' weight='regular'>
							{group.inviteCode}
						</Typography>
					</>
				) : null}
				<AppButton
					{...(isCopied ? { icon: 'check' as const } : {})}
					onPress={handleCopyCode}
					size='md'
					title={isCopied ? t('copied') : t('copyInvite')}
					variant={isCopied ? 'surface' : 'primary'}
				/>
			</CardSurface>
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	card: {
		alignItems: 'center',
		padding: 18
	},
	code: {
		// 34/1.1 with the design's wide tracking — bigger than `header1`'s own 27, because
		// this is the one string on the sheet somebody has to read out loud.
		fontSize: 34,
		letterSpacing: 2.7,
		lineHeight: 37,
		marginBottom: 16,
		marginTop: 8
	}
});
