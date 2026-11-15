import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import type { ScreenHeaderProps } from '@/components/ScreenHeader/ScreenHeader.types';
import { StyleSheet, View } from 'react-native';
import { Bone, SkeletonPulse } from './Skeleton.component';

type ScreenHeaderSkeletonProps = Omit<ScreenHeaderProps, 'subtitle'> & {
	/** The subtitle's bone — its text is counted from the data, so only its line is known. */
	subtitleWidth: number | `${number}%`;
};

/** `ScreenTitle`'s 18 under the caption, and the bone centred in the caption's 17pt line. */
const SUBTITLE_BONE_BOTTOM = 18 + (17 - 8) / 2;

/**
 * A pushed screen's real heading — its title and eyebrow are known before the data — with a
 * bone where the subtitle will be. The subtitle's line is held by a blank caption, so the
 * heading is already its final height and nothing under it moves when the words arrive.
 */
export const ScreenHeaderSkeleton = ({ subtitleWidth, ...header }: ScreenHeaderSkeletonProps) => (
	<View>
		<ScreenHeader {...header} subtitle={' '} />
		<SkeletonPulse style={styles.subtitle}>
			<Bone height={8} radius={4} tone='soft' width={subtitleWidth} />
		</SkeletonPulse>
	</View>
);

const styles = StyleSheet.create({
	subtitle: {
		bottom: SUBTITLE_BONE_BOTTOM,
		left: 0,
		position: 'absolute',
		right: 0
	}
});
