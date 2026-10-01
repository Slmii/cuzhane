import { Typography } from '@/components/ui/Typography/Typography.component';
import type { LiveMark, ReaderNumerals } from '@/lib/types/domain';
import type { BandRect } from '@/screens/Live/LiveBand.component';
import { cevsenParagraph } from '@/screens/Reader/ReaderBody.component';
import { Fragment, useCallback, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type TextLayoutEvent } from 'react-native';

/*
 * "Göster" in the free Cevşen: where invocation n of the bab on screen sits, as band pieces.
 *
 * The bab is one flowing right-to-left paragraph, so an invocation is a run of characters that may
 * start or end in the middle of a line. The paragraph reports its lines (`onTextLayout`, each with
 * its text); consuming them in order turns `cevsenParagraph`'s character offsets into lines. A line
 * an invocation shares with a neighbour is split where the words do: a hidden copy of that line's
 * beginning, up to each invocation's end, is measured once per bab and size, and in right-to-left
 * text that width is how far in from the line's right edge the next invocation begins.
 */

/* The design's measures ("Bant ölçüleri"). */
/** Between two pieces of the same invocation, one above the other. */
const PIECE_GAP = 8;
const PIECE_RADIUS = 10;
/** How far a piece reaches past the text at a line's outer edge. */
const OUTER_REACH = 10;

/** Two probes whose difference is one space in the words' face (alef does not join). */
const SPACE_PROBES = ['ا ا', 'اا'] as const;

type Line = { start: number; contentEnd: number; x: number; y: number; width: number; height: number };

/** One measurement: the paragraph's characters [start, end), set as the paragraph sets them. */
type Probe = { start: number; end: number };

type Request = {
	key: string;
	babNumber: number;
	lines: Line[];
	probes: Probe[];
	paragraph: ReturnType<typeof cevsenParagraph>;
};

type Geometry = {
	babNumber: number;
	pieces: Map<number, BandRect[]>;
	/** The same pieces at the full line height, for finding an invocation under a finger. */
	hits: { n: number; x: number; y: number; w: number; h: number }[];
};

type Faces = {
	arabicFont: string;
	arabicFontSize: number;
	baseFontSize: number;
	ornamentFont: string;
	ornamentFontSize: number;
};

const isSpace = (char: string | undefined) => char !== undefined && /\s/u.test(char);

/** The paragraph's characters [start, end) as spans: the ornaments in their own face. */
const styledSlice = (paragraph: Request['paragraph'], start: number, end: number, faces: Faces): ReactNode[] => {
	const nodes: ReactNode[] = [];
	let at = start;

	for (const [markStart, markEnd] of paragraph.marks) {
		if (markEnd <= at || markStart >= end) {
			continue;
		}

		if (markStart > at) {
			nodes.push(<Fragment key={`t${at}`}>{paragraph.text.slice(at, markStart)}</Fragment>);
		}

		nodes.push(
			<Typography
				key={`m${markStart}`}
				style={{
					fontFamily: faces.ornamentFont,
					fontSize: faces.ornamentFontSize,
					lineHeight: faces.baseFontSize * 2
				}}
			>
				{paragraph.text.slice(Math.max(at, markStart), Math.min(end, markEnd))}
			</Typography>
		);
		at = Math.min(end, markEnd);
	}

	if (at < end) {
		nodes.push(<Fragment key={`t${at}`}>{paragraph.text.slice(at, end)}</Fragment>);
	}

	return nodes;
};

const computeGeometry = (
	request: Request,
	widths: number[],
	origin: { x: number; y: number; width: number }
): Geometry => {
	const { lines, paragraph, probes } = request;
	const probeWidth = new Map<string, number>();

	probes.forEach((probe, index) => probeWidth.set(`${probe.start}:${probe.end}`, widths[index] ?? 0));

	const twoAlefsSpaced = widths[probes.length] ?? 0;
	const twoAlefs = widths[probes.length + 1] ?? 0;
	const space = Math.max(0, twoAlefsSpaced - twoAlefs);
	const pieces = new Map<number, BandRect[]>();
	const hits: Geometry['hits'] = [];

	for (const span of paragraph.spans) {
		const own: BandRect[] = [];

		for (const line of lines) {
			const from = Math.max(span.start, line.start);
			const to = Math.min(span.end, line.contentEnd);

			if (from >= to) {
				continue;
			}

			/*
			 * **The line's ink is centred on the paragraph** (`textAlign: 'center'`, not justified), so
			 * its edges come from the measured copy rather than the platform's line box: Android counts
			 * the line's trailing space into `width` and puts it on the right, a space's width off.
			 */
			const full = probeWidth.get(`${line.start}:${line.contentEnd}`) ?? line.width;
			const right = origin.x + (origin.width + full) / 2;
			const left = right - full;
			const towardNeighbour = Math.min(OUTER_REACH, space / 2);
			// Starts mid-line: the line holds the previous invocation's end, then one space.
			const startsHere = from > line.start;
			const endsHere = to < line.contentEnd;
			const prefixBefore = probeWidth.get(`${line.start}:${from - 1}`) ?? 0;
			const prefixThrough = probeWidth.get(`${line.start}:${to}`) ?? 0;
			const pieceRight = startsHere ? right - prefixBefore - space + towardNeighbour : right + OUTER_REACH;
			const pieceLeft = endsHere ? right - prefixThrough - towardNeighbour : left - OUTER_REACH;
			const x = Math.round(pieceLeft);
			const w = Math.round(pieceRight) - x;
			const y = origin.y + line.y;

			own.push({ h: line.height - PIECE_GAP, r: PIECE_RADIUS, w, x, y: Math.round(y + PIECE_GAP / 2) });
			hits.push({ h: line.height, n: span.n, w, x, y });
		}

		pieces.set(span.n, own);
	}

	return { babNumber: request.babNumber, hits, pieces };
};

/**
 * The band's geometry for the free Cevşen. Everything lives in refs and is read when the band asks
 * (`rectsFor`); the only state is `layoutVersion`, bumped when the paragraph lays out anew, and the
 * hidden measuring copy — neither changes on a tap, so the Arabic never re-renders for one.
 */
export const useCevsenBandGeometry = ({
	babNumber,
	faces,
	numerals
}: {
	babNumber: number;
	faces: Faces;
	numerals: ReaderNumerals;
}) => {
	const { arabicFont, arabicFontSize, baseFontSize, ornamentFont, ornamentFontSize } = faces;
	const [request, setRequest] = useState<Request | null>(null);
	const [layoutVersion, setLayoutVersion] = useState(0);
	const originRef = useRef({ width: 0, x: 0, y: 0 });
	const widthsRef = useRef<{ key: string; widths: number[] } | null>(null);
	const geometryRef = useRef<Geometry | null>(null);
	const requestRef = useRef<Request | null>(null);
	const onReadyRef = useRef<(() => void) | null>(null);

	const recompute = useCallback(() => {
		const current = requestRef.current;
		const measured = widthsRef.current;

		if (!current || !measured || measured.key !== current.key) {
			return;
		}

		geometryRef.current = computeGeometry(current, measured.widths, originRef.current);
		setLayoutVersion(version => version + 1);
		onReadyRef.current?.();
	}, []);

	const onParagraphLayout = useCallback(
		(event: LayoutChangeEvent) => {
			const { width, x, y } = event.nativeEvent.layout;
			const current = originRef.current;

			if (x === current.x && y === current.y && width === current.width) {
				return;
			}

			originRef.current = { width, x, y };
			recompute();
		},
		[recompute]
	);

	const onParagraphTextLayout = useCallback(
		(event: TextLayoutEvent) => {
			const paragraph = cevsenParagraph(babNumber, numerals);
			const lines: Line[] = [];
			let at = 0;

			for (const line of event.nativeEvent.lines) {
				let contentEnd = at + line.text.length;

				while (contentEnd > at && isSpace(paragraph.text[contentEnd - 1])) {
					contentEnd -= 1;
				}

				lines.push({ contentEnd, height: line.height, start: at, width: line.width, x: line.x, y: line.y });
				at += line.text.length;
			}

			// The lines must be the paragraph `cevsenParagraph` describes, or no offset means anything.
			if (at !== paragraph.text.length) {
				requestRef.current = null;
				geometryRef.current = null;
				setRequest(null);
				return;
			}

			const probes: Probe[] = [];

			for (const line of lines) {
				probes.push({ end: line.contentEnd, start: line.start });

				for (const span of paragraph.spans) {
					// An invocation ending mid-line: the beginning of the line through its ornament.
					if (span.end > line.start && span.end < line.contentEnd) {
						probes.push({ end: span.end, start: line.start });
					}
				}
			}

			const key = [
				babNumber,
				numerals,
				arabicFont,
				arabicFontSize,
				ornamentFont,
				ornamentFontSize,
				...lines.map(line => `${line.start}-${line.contentEnd}@${line.x},${line.y},${line.width}`)
			].join('|');

			if (requestRef.current?.key === key) {
				return;
			}

			const next = { babNumber, key, lines, paragraph, probes };

			requestRef.current = next;
			setRequest(next);
			recompute();
		},
		[arabicFont, arabicFontSize, babNumber, numerals, ornamentFont, ornamentFontSize, recompute]
	);

	const onMeasured = useCallback(
		(event: TextLayoutEvent) => {
			const current = requestRef.current;

			if (!current) {
				return;
			}

			widthsRef.current = { key: current.key, widths: event.nativeEvent.lines.map(line => line.width) };
			recompute();
		},
		[recompute]
	);

	const rectsFor = useCallback((mark: LiveMark): BandRect[] | null => {
		const geometry = geometryRef.current;

		if (mark.k !== 'CEVSEN' || !geometry || geometry.babNumber !== mark.bab) {
			return null;
		}

		return geometry.pieces.get(mark.n) ?? null;
	}, []);

	/** The invocation under a point in the scroll content, or null. */
	const invocationAt = useCallback((x: number, y: number) => {
		const hit = geometryRef.current?.hits.find(
			piece => x >= piece.x && x <= piece.x + piece.w && y >= piece.y && y <= piece.y + piece.h
		);

		return hit?.n ?? null;
	}, []);

	/** The invocation under a point given in the paragraph's own coordinates — where a tap on it lands. */
	const invocationInParagraph = useCallback(
		(x: number, y: number) => invocationAt(x + originRef.current.x, y + originRef.current.y),
		[invocationAt]
	);

	/**
	 * The hidden copy: every probe as its own line of one paragraph, set in the page's faces at the
	 * page's size, then the two space probes. Unconstrained in width, so nothing wraps.
	 */
	const measurer =
		request === null ? null : (
			<View
				accessibilityElementsHidden
				importantForAccessibility='no-hide-descendants'
				pointerEvents='none'
				style={styles.measurer}
			>
				<Typography
					key={request.key}
					onTextLayout={onMeasured}
					style={{
						fontFamily: arabicFont,
						fontSize: arabicFontSize,
						lineHeight: baseFontSize * 2,
						writingDirection: 'rtl'
					}}
				>
					{request.probes.map((probe, index) => (
						<Fragment key={index}>
							{styledSlice(request.paragraph, probe.start, probe.end, faces)}
							{'\n'}
						</Fragment>
					))}
					{SPACE_PROBES.join('\n')}
				</Typography>
			</View>
		);

	return {
		invocationInParagraph,
		layoutVersion,
		measurer,
		onParagraphLayout,
		onParagraphTextLayout,
		/** Called once a laid-out bab's geometry is ready — the follower brings the band into view. */
		onReadyRef,
		rectsFor
	};
};

const styles = StyleSheet.create({
	measurer: {
		alignItems: 'flex-start',
		left: 0,
		opacity: 0,
		position: 'absolute',
		top: 0,
		width: 4000
	}
});
