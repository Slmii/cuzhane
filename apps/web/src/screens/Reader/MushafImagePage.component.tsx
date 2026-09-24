import { AppButton } from '@/components/ui/Button/Button.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { MUSHAF_PAGE_ASPECT } from '@/lib/content/mushaf';
import { useMushafPage } from '@/lib/hooks/useMushafPage';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

type MushafImagePageProps = {
	/** The page on screen, by its served path — `mushafPagePath(page)` or one of `MUSHAF_DUA_PATHS`. */
	path: string;
	/** The page after it, fetched ahead; `undefined` on the last. */
	nextPath: string | undefined;
	/** "Sayfa 3 / 20" — what a screen reader hears for an image of Arabic it cannot read out. */
	accessibilityLabel: string;
	/** The page has drawn — the moment the reader moves back to its top. */
	onShown?: () => void;
};

/** An image that fails to draw is fetched afresh once; failing again, it offers Tekrar dene. */
const MAX_AUTOMATIC_REDOWNLOADS = 1;
const PAPER_PADDING = 8;

/**
 * Where the page sits on its paper, from the paper's width alone: the paper and the image's
 * frame share the page's shape, and the frame is centred inside the paper's padding. The reader
 * uses it to hang the sajdah mark on the paper and to find the verse's green — arithmetic
 * rather than measurement, so it is known before the image arrives.
 */
export const mushafPaperGeometry = (paperWidth: number) => {
	const paperHeight = paperWidth / MUSHAF_PAGE_ASPECT;
	const frameHeight = (paperWidth - PAPER_PADDING * 2) / MUSHAF_PAGE_ASPECT;

	return { frameHeight, frameY: (paperHeight - frameHeight) / 2, paperHeight };
};

/**
 * The paper is always light** (`mushafPaper`): the image is black ink on a transparent
 * ground. It is laid out at the page's own shape before the image arrives, so the reader never
 * jumps when it lands.
 *
 * **The page being left stays until the next one has drawn.** A new image is decoded after it
 * mounts, so swapping one for the other showed a frame of bare paper on every turn — and, from
 * a scrolled page, that frame also jumped to the top, which read as a flicker. The new page
 * loads hidden over the old one, and its `onLoad` swaps them in one render and calls `onShown`,
 * where the reader resets its scroll, so the jump and the new page land together. Hidden, not
 * merely on top: the ink sits on a transparent ground, and the old page would show through.
 *
 * **An image that fails to draw is thrown away and fetched again** — a cached file the OS has
 * since cleared, or a torn one. The redownload lands at the same path, and React Native does
 * not reload an image whose source is unchanged, so each attempt remounts it by `key`.
 */
export const MushafImagePage = ({ accessibilityLabel, nextPath, onShown, path }: MushafImagePageProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const pageQuery = useMushafPage(path, nextPath);
	const [imageFailures, setImageFailures] = useState(0);
	// The page last drawn, and the file it was drawn from.
	const [shown, setShown] = useState<{ path: string; uri: string } | null>(null);
	// A new page starts with no failures behind it — adjusted during render, since the
	// component is no longer remounted per page.
	const [failuresPath, setFailuresPath] = useState(path);

	if (failuresPath !== path) {
		setFailuresPath(path);
		setImageFailures(0);
	}

	const isCurrentShown = shown?.path === path;
	const leaving = shown && !isCurrentShown ? shown : null;
	const hasFailed = pageQuery.isError || imageFailures > MAX_AUTOMATIC_REDOWNLOADS;

	const handleImageError = () => {
		setImageFailures(failures => failures + 1);

		if (imageFailures < MAX_AUTOMATIC_REDOWNLOADS) {
			pageQuery.redownload();
		}
	};

	const handleImageLoad = () => {
		if (pageQuery.data && !isCurrentShown) {
			setShown({ path, uri: pageQuery.data });
			onShown?.();
		}
	};

	const handleRetry = () => {
		setImageFailures(0);
		pageQuery.redownload();
	};

	return (
		<View
			style={[styles.paper, { backgroundColor: theme.colors.mushafPaper, borderColor: theme.colors.readerRule }]}
		>
			{hasFailed ? (
				<View style={styles.failed}>
					{/* On the paper, which is light in both themes — so the ink colour, not `subtext`. */}
					<CaptionText color={theme.colors.codeInk} textAlign='center'>
						{t('qPageLoadFailed')}
					</CaptionText>
					<AppButton fullWidth={false} onPress={handleRetry} title={t('retry')} variant='surface' />
				</View>
			) : pageQuery.data || leaving ? (
				// The page's exact shape, so a position read in fractions of the page lands on it.
				<View style={styles.frame}>
					{leaving ? (
						<Image
							accessibilityIgnoresInvertColors
							fadeDuration={0}
							resizeMode='contain'
							source={{ uri: leaving.uri }}
							style={styles.leaving}
						/>
					) : null}
					{pageQuery.data ? (
						<Image
							accessibilityIgnoresInvertColors
							accessibilityLabel={accessibilityLabel}
							// Android fades every image in over 300ms, so each turn washed the page in
							// from blank paper. A page is a page; it arrives as one.
							fadeDuration={0}
							key={imageFailures}
							onError={handleImageError}
							onLoad={handleImageLoad}
							resizeMode='contain'
							source={{ uri: pageQuery.data }}
							style={[styles.image, !isCurrentShown && styles.hidden]}
						/>
					) : null}
				</View>
			) : (
				<ActivityIndicator color={theme.colors.codeInk} />
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	failed: {
		alignItems: 'center',
		gap: 12,
		paddingHorizontal: 24
	},
	frame: {
		aspectRatio: MUSHAF_PAGE_ASPECT,
		width: '100%'
	},
	hidden: {
		opacity: 0
	},
	image: {
		height: '100%',
		width: '100%'
	},
	leaving: {
		bottom: 0,
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	},
	paper: {
		alignItems: 'center',
		aspectRatio: MUSHAF_PAGE_ASPECT,
		borderRadius: 12,
		borderWidth: StyleSheet.hairlineWidth,
		justifyContent: 'center',
		overflow: 'hidden',
		padding: PAPER_PADDING,
		width: '100%'
	}
});
