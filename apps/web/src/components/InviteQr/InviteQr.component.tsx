import { BrandMarkGlyph } from '@/components/ui/BrandMark/BrandMark.component';
import { CaptionText, EyebrowText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { inviteLink } from '@/lib/utils/inviteCode';
import QRCode from 'qrcode';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import type { InviteQrProps } from './InviteQr.types';

/**
 * The design's QR Generator (`QR Generator.dc.html` / `cuzhane-qr.js`), drawn here with the
 * app's own SVG rather than its script: the matrix comes from `qrcode` (ECC M, pinned to
 * version 3 — see `QR_VERSION`), and everything on top of it is the generator's recipe —
 *
 * - **dotted modules**: every dark module is a disc of `DOT_SCALE` of its cell, so the code
 *   reads as a field of dots rather than a block of squares;
 * - **finder eyes** in sage: a rounded 6×6 outline with a rounded 3×3 core, in place of the
 *   standard black squares;
 * - **the mark in the middle**: a 5×5-module zone is cleared and a sage plate carries the
 *   app icon (`ui/BrandMark`'s glyph, one geometry for both) in the plate colour. ECC M
 *   absorbs the cleared zone; don't enlarge it;
 * - **the quiet zone is in the viewBox** (four modules), and the plate around it is a
 *   warm paper in both themes — a scanner does not read light modules on dark reliably, so
 *   dark mode gets the generator's warmer plate and deeper ink rather than an inversion.
 *
 * Under the code on the share sheet and in the lobby, the two places the code is shown to be
 * passed on. It encodes the app's one link (`inviteLink`): a camera pointed at it opens
 * Cüzhane on the join sheet with the code already looked up.
 */

/** Rendered size, quiet zone included. */
const QR_SIZE = 200;
/** Modules of clear space around the symbol, baked into the viewBox. The standard minimum. */
const QUIET_MODULES = 4;
/** Module fill ratio: 1 would make the dots touch into squares. */
const DOT_SCALE = 0.76;
/** Side of the cleared zone the emblem sits in, in modules. */
const EMBLEM_MODULES = 5;
const EYE_MODULES = 7;
/** The plate's corner and its padding — small, since the quiet zone is already in the viewBox. */
const PLATE_RADIUS = 18;
const PLATE_PADDING = 5;

/** The generator fades the mark's unread columns to 55% of the plate colour. */
const MARK_FADED_OPACITY = 0.55;

interface QrGeometry {
	/** Symbol side in modules. */
	n: number;
	/** Every dark module outside the eyes and the emblem zone, as one path of discs. */
	dots: string;
	/** Top-left module of the emblem zone. */
	emblemOrigin: number;
}

/**
 * Pinned, not chosen: the payload is `cuzhane://groups/join/` plus eight characters, which is a
 * version-3 symbol, and the centre zone is only known to be safe there — it sits clear of the
 * timing rows and version 3's single alignment pattern, and costs at most seven of the
 * thirteen codewords ECC M can recover. From version 7 up the alignment grid puts a pattern in
 * the middle, under the emblem. So a payload that outgrows version 3 fails to encode rather
 * than silently producing a code that scans badly — and `null` here draws no QR at all.
 */
const QR_VERSION = 3;

const buildGeometry = (value: string): QrGeometry | null => {
	let modules: QRCode.BitMatrix;

	try {
		({ modules } = QRCode.create(value, { errorCorrectionLevel: 'M', version: QR_VERSION }));
	} catch {
		return null;
	}

	const n = modules.size;
	const emblemOrigin = Math.round((n - EMBLEM_MODULES) / 2);
	const emblemEnd = emblemOrigin + EMBLEM_MODULES;
	const radius = DOT_SCALE / 2;

	const isInEye = (row: number, column: number) =>
		(row < EYE_MODULES && column < EYE_MODULES) ||
		(row < EYE_MODULES && column >= n - EYE_MODULES) ||
		(row >= n - EYE_MODULES && column < EYE_MODULES);
	const isInEmblem = (row: number, column: number) =>
		row >= emblemOrigin && row < emblemEnd && column >= emblemOrigin && column < emblemEnd;

	let dots = '';

	for (let row = 0; row < n; row += 1) {
		for (let column = 0; column < n; column += 1) {
			if (modules.data[row * n + column] !== 1 || isInEye(row, column) || isInEmblem(row, column)) {
				continue;
			}

			const cx = column + 0.5;
			const cy = row + 0.5;
			// A disc as two half-circle arcs, the way the generator draws it.
			dots += `M${cx - radius} ${cy}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${
				-radius * 2
			} 0`;
		}
	}

	return { dots, emblemOrigin, n };
};

export const InviteQr = ({ inviteCode }: InviteQrProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const value = inviteLink(inviteCode);
	const geometry = useMemo(() => buildGeometry(value), [value]);

	// The code beside it still says everything; a QR that could not be built is simply absent.
	if (geometry === null) {
		return null;
	}

	const { dots, emblemOrigin, n } = geometry;
	const eyes: readonly (readonly [x: number, y: number])[] = [
		[0, 0],
		[n - EYE_MODULES, 0],
		[0, n - EYE_MODULES]
	];
	const viewBox = `${-QUIET_MODULES} ${-QUIET_MODULES} ${n + QUIET_MODULES * 2} ${n + QUIET_MODULES * 2}`;
	const { codeAccent, codeInk, codePaper } = theme.colors;

	return (
		<View style={styles.block}>
			<View
				// One element to a screen reader, not a hundred SVG nodes.
				accessible
				accessibilityLabel={t('shareQrLabel')}
				accessibilityRole='image'
				style={[styles.plate, { backgroundColor: codePaper, borderColor: theme.colors.border }]}
			>
				<Svg height={QR_SIZE} viewBox={viewBox} width={QR_SIZE}>
					<Path d={dots} fill={codeInk} />
					{eyes.map(([x, y]) => (
						<G key={`${x}-${y}`}>
							<Rect
								fill='none'
								height={6}
								rx={2}
								stroke={codeAccent}
								strokeWidth={1}
								width={6}
								x={x + 0.5}
								y={y + 0.5}
							/>
							<Rect fill={codeAccent} height={3} rx={1} width={3} x={x + 2} y={y + 2} />
						</G>
					))}
					<Rect
						fill={codeAccent}
						height={4.3}
						rx={1.3}
						width={4.3}
						x={emblemOrigin + 0.35}
						y={emblemOrigin + 0.35}
					/>
					{/* The mark's 100-unit box scaled into 2.9 modules, centred on the plate. */}
					<G transform={`translate(${emblemOrigin + 1.05} ${emblemOrigin + 1.05}) scale(${2.9 / 100})`}>
						<BrandMarkGlyph
							fadedColor={toAlphaColor(codePaper, MARK_FADED_OPACITY)}
							solidColor={codePaper}
						/>
					</G>
				</Svg>
			</View>
			<EyebrowText color={theme.colors.faintText}>{t('shareQrLabel')}</EyebrowText>
			<CaptionText color={theme.colors.subtext} style={styles.hint} textAlign='center'>
				{t('shareQrHint')}
			</CaptionText>
		</View>
	);
};

const styles = StyleSheet.create({
	block: {
		alignItems: 'center',
		gap: 4
	},
	hint: {
		maxWidth: 260
	},
	plate: {
		borderRadius: PLATE_RADIUS,
		borderWidth: StyleSheet.hairlineWidth,
		marginBottom: 8,
		padding: PLATE_PADDING
	}
});
