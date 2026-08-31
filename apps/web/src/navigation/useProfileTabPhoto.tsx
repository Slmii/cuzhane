import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Image as SvgImage } from 'react-native-svg';

/** 28pt at 3×, matching the rasterised glyph assets beside it in the bar. */
const SIZE = 84;

/**
 * The reader's profile photo, cropped to a circle and handed back as a data URI the **native**
 * tab bar can take.
 *
 * A `UITabBar` item is an image, and it draws that image as-is — square. Every other icon in
 * this bar is a round-shouldered glyph, and the app draws a person's picture as a circle
 * everywhere else (`ui/Avatar`, the profile header), so a square photograph in the row reads
 * as a rendering fault rather than a portrait. There is no mask to ask the bar for and no
 * crop parameter to ask Clerk for, so the rounding happens here.
 *
 * **`react-native-svg` does it because it is already a dependency.** The alternative was a
 * native image library added for one 28-point circle. An off-screen `<Svg>` clips the remote
 * image to a circle and `toDataURL` reads the result back as base64 — the same trick the
 * library documents for exporting a chart.
 *
 * Returns the URI and the element that produces it. The element renders `null` once the
 * capture lands, so the off-screen tree costs nothing after the first paint, and it remounts
 * whenever the photo changes — which is what makes a newly uploaded picture appear in the bar
 * without a relaunch.
 */
export const useProfileTabPhoto = (imageUrl: string | null) => {
	const svgRef = useRef<Svg>(null);
	/*
	 * The capture remembers **which** photo it is of, so a changed picture invalidates it by
	 * simply not matching any more. An effect that cleared the URI on every change of
	 * `imageUrl` would do the same thing and cost a cascading render to do it.
	 */
	const [capture, setCapture] = useState<{ uri: string; url: string } | null>(null);
	const uri = capture && capture.url === imageUrl ? capture.uri : null;

	/*
	 * Captured on the image's own `onLoad`, not on mount: `toDataURL` snapshots whatever the
	 * view is showing, and a remote image that has not arrived yet snapshots as nothing.
	 */
	const handleLoad = () => {
		if (!imageUrl) {
			return;
		}

		svgRef.current?.toDataURL(base64 => setCapture({ uri: `data:image/png;base64,${base64}`, url: imageUrl }), {
			height: SIZE,
			width: SIZE
		});
	};

	const captureElement =
		imageUrl && !uri ? (
			<Svg height={SIZE} ref={svgRef} style={styles.offscreen} width={SIZE}>
				<Defs>
					<ClipPath id='profileTabPhoto'>
						<Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2} />
					</ClipPath>
				</Defs>
				<SvgImage
					clipPath='url(#profileTabPhoto)'
					height={SIZE}
					href={{ uri: imageUrl }}
					onLoad={handleLoad}
					// A portrait is taller than it is wide; `slice` fills the circle and crops the
					// overflow rather than letterboxing the face into a square.
					preserveAspectRatio='xMidYMid slice'
					width={SIZE}
				/>
			</Svg>
		) : null;

	return { captureElement, uri };
};

const styles = StyleSheet.create({
	/*
	 * Off-screen rather than `display: none` or zero-sized: the view has to be laid out and
	 * painted for `toDataURL` to have anything to read, and an undisplayed one never is.
	 */
	offscreen: {
		left: -SIZE * 2,
		position: 'absolute',
		top: -SIZE * 2
	}
});
