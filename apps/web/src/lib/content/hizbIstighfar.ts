import { HIZB_SECTIONS, type HizbBlock, type HizbLine } from './hizbulhakaik';

export type IstighfarParts = { introduction: HizbBlock; sentence: HizbLine; marker: HizbLine };
// Exact source anchors: ordinary Arabic verse numbers do not imply repetition.
const sentenceText = HIZB_SECTIONS[0].blocks[0].lines[3].text;
const markerText = '﴾١١–٣٣–١٠٠﴿';
export const splitIstighfar = (block: HizbBlock): IstighfarParts | null => {
	const sentence = block.lines[block.lines.length - 2];
	const marker = block.lines[block.lines.length - 1];
	if (sentence?.text !== sentenceText || marker?.text !== markerText) {
		return null;
	}
	return { introduction: { lines: block.lines.slice(0, -2) }, sentence, marker };
};
