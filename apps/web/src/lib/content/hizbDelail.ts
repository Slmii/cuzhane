import { HIZB_SECTIONS, type HizbBlock } from './hizbulhakaik';

// One explicitly identified salawat. Other occurrences of Arabic ٣ are not repetition rules.
const passageText = HIZB_SECTIONS[9].blocks[1].lines[0].text;
export const splitDelailRepetition = (block: HizbBlock) => {
	if (block.lines[0]?.text !== passageText || !passageText.endsWith('﴿٣﴾')) {
		return null;
	}
	return { passage: { lines: block.lines.slice(0, 1) }, after: { lines: block.lines.slice(1) } };
};
