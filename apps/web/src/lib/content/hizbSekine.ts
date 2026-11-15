import { HIZB_SECTIONS, type HizbBlock } from './hizbulhakaik';

export type SekineParts = { title: HizbBlock; opening: HizbBlock; repeated: HizbBlock; instruction: HizbBlock };

// Exact source anchors. The book's own last line says what repeats — from the besmele, nineteen
// times. So the title is not recited, the takbirs before the besmele are read once, and that
// instruction line is not recited either.
const sekine = HIZB_SECTIONS[10].blocks[0];
const besmeleText = sekine.lines[2].text;
const instructionText = sekine.lines[sekine.lines.length - 1].text;

export const splitSekine = (block: HizbBlock): SekineParts | null => {
	const besmele = block.lines.findIndex(line => line.text === besmeleText);
	const title = block.lines[0];
	const instruction = block.lines[block.lines.length - 1];

	if (title?.text !== sekine.lines[0].text || besmele < 2 || instruction?.text !== instructionText) {
		return null;
	}

	return {
		title: { lines: [title] },
		opening: { lines: block.lines.slice(1, besmele) },
		repeated: { lines: block.lines.slice(besmele, -1) },
		instruction: { lines: [instruction] }
	};
};

/** Sekine is read nineteen times. */
export const SEKINE_REPETITIONS = 19;
