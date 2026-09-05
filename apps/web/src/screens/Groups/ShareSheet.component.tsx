import { InviteQr } from '@/components/InviteQr/InviteQr.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupDetail } from '@/lib/types/domain';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
	group: GroupDetail;
	isVisible: boolean;
	onClose: () => void;
};

const COPIED_RESET_MS = 1600;

/**
 * The invite: the code as the hero at 34pt, to be read out and typed, and the same code as a
 * QR beneath it for whoever is in the room. The QR encodes the app's one link (`inviteLink`)
 * and nothing else displays that URL — scanning is a way of typing the code, not of sharing
 * it, and there is no web fallback.
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
			<View style={styles.body}>
				{/*
				 * **A surface behind the code, and only the code.** The design put the whole block
				 * on a `CardSurface` to lift it off the sheet's cream; the sheet is the platform's
				 * own material now, so a card around *everything* was white on white and the
				 * button inside it read as nested. The code is the one thing that has to stand off
				 * the sheet — it is read aloud and typed in at the other end — so it keeps a panel
				 * of its own and the button sits on the sheet itself.
				 *
				 * That panel is a `CardSurface` rather than a hand-rolled `surface` fill, so the
				 * code sits on the same material as every other panel in the app. Being inside a
				 * sheet is the point rather than an objection: it has to read as its own surface
				 * against the one behind it.
				 */}
				{group.inviteCode ? (
					<CardSurface style={styles.codePanel}>
						<EyebrowText color={theme.colors.faintText}>{t('inviteCode')}</EyebrowText>
						<Typography color={theme.colors.accent} style={styles.code} variant='header1' weight='regular'>
							{group.inviteCode}
						</Typography>
						{/* The same code for whoever is in the room — see `InviteQr`. */}
						<View style={styles.qr}>
							<InviteQr inviteCode={group.inviteCode} />
						</View>
					</CardSurface>
				) : null}
				{/*
				 * `copy` at rest, `check` once it lands. The button carried no icon until the
				 * tick appeared, so confirming also *added* a glyph and shunted the label
				 * sideways; now one icon swaps for another in place.
				 */}
				<AppButton
					icon={isCopied ? 'check' : 'copy'}
					onPress={handleCopyCode}
					title={isCopied ? t('copied') : t('copyInvite')}
					variant={isCopied ? 'surface' : 'primary'}
				/>
			</View>
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	/** Centred, and with the card's own padding gone — the sheet already insets its content. */
	body: {
		alignItems: 'center'
	},
	/** Full width so the panel spans the sheet, with the code centred inside it. */
	codePanel: {
		alignItems: 'center',
		alignSelf: 'stretch',
		marginBottom: 16,
		paddingHorizontal: 18,
		paddingVertical: 18
	},
	code: {
		// 34/1.1 with the design's wide tracking — bigger than `header1`'s own 27, because
		// this is the one string on the sheet somebody has to read out loud.
		fontSize: 34,
		letterSpacing: 2.7,
		lineHeight: 37,
		marginTop: 8
	},
	qr: {
		marginTop: 18
	}
});
