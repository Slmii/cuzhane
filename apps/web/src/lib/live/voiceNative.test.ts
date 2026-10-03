import { describe, expect, it } from 'vitest';
import { readSample } from './voiceNative';

/** A stats report as `react-native-webrtc` hands it over: a Map of every entry, members and all. */
const report = (entries: Record<string, unknown>[]) => new Map(entries.map((entry, index) => [String(index), entry]));

describe('readSample', () => {
	it('reads the reader’s microphone from its media-source — outbound-rtp has no level', () => {
		const sample = readSample(
			report([
				{ kind: 'audio', type: 'outbound-rtp', packetsSent: 120 },
				{
					audioLevel: 0.12,
					kind: 'audio',
					totalAudioEnergy: 0.4,
					totalSamplesDuration: 12.5,
					type: 'media-source'
				},
				{ type: 'transport' }
			])
		);

		expect(sample).toEqual({ duration: 12.5, energy: 0.4, level: 0.12, packets: null });
	});

	it('reads a listener’s level, energy and packets from the incoming stream', () => {
		const sample = readSample(
			report([
				{
					audioLevel: 0.04,
					kind: 'audio',
					packetsReceived: 300,
					totalAudioEnergy: 0.2,
					totalSamplesDuration: 6,
					type: 'inbound-rtp'
				},
				{ type: 'candidate-pair' }
			])
		);

		expect(sample).toEqual({ duration: 6, energy: 0.2, level: 0.04, packets: 300 });
	});

	it('takes the energy only as a pair, and nothing from video', () => {
		const sample = readSample(
			report([
				{ audioLevel: 0.5, kind: 'video', type: 'media-source' },
				{ audioLevel: 0.03, kind: 'audio', totalAudioEnergy: 0.2, type: 'inbound-rtp' }
			])
		);

		expect(sample).toEqual({ duration: null, energy: null, level: 0.03, packets: null });
	});
});
