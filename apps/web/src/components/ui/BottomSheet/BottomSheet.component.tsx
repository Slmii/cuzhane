import { IsInsideSheetProvider } from '@/components/ui/BottomSheet/BottomSheet.context';
import { Header2, Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppBottomSheetProps } from './BottomSheet.types';

/**
 * The one sheet in the app — every "modal" surface goes through it so they all get the
 * same grabber, spring, fading backdrop and drag-to-dismiss.
 *
 * Declarative on purpose: callers flip `isVisible` instead of juggling present/dismiss
 * refs, which keeps sheet state alongside the rest of a screen's state. There is no
 * close button; the grabber, a downward drag and a tap on the backdrop all dismiss.
 */
export const AppBottomSheet = ({
	children,
	description,
	hasScrollableContent = false,
	isVisible,
	maxHeight,
	onClose,
	snapPoints,
	title,
	topInset
}: AppBottomSheetProps) => {
	const { theme } = useThemeContext();
	const insets = useSafeAreaInsets();
	const sheetRef = useRef<BottomSheetModal>(null);
	// Fixed detents mean the sheet no longer measures its content, so the body has to
	// fill the detent itself instead of hugging the children.
	const hasFixedHeight = snapPoints !== undefined;
	const paddingBottom = Math.max(insets.bottom, 24);

	/**
	 * The modal is mounted on demand rather than kept alive and toggled with
	 * `present()`/`dismiss()`. On a screen that has been mounted since app start — which
	 * is every tab root — a `present()` call arriving long after mount is silently
	 * dropped, so the sheet would never appear. Presenting a freshly mounted modal is
	 * reliable, and unmounting after `onDismiss` keeps the closing animation intact.
	 */
	const [isMounted, setIsMounted] = useState(isVisible);

	// Adjusting state during render rather than in an effect, so the modal exists on the
	// very same commit that `isVisible` flips — an extra frame here loses the present.
	if (isVisible && !isMounted) {
		setIsMounted(true);
	}

	// Present as soon as the modal exists.
	useEffect(() => {
		if (isMounted) {
			sheetRef.current?.present();
		}
	}, [isMounted]);

	// A caller-driven close (Apply, a confirm button) still animates out.
	useEffect(() => {
		if (!isVisible && isMounted) {
			sheetRef.current?.dismiss();
		}
	}, [isMounted, isVisible]);

	const handleDismiss = useCallback(() => {
		setIsMounted(false);
		onClose();
	}, [onClose]);

	const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) => (
			<BottomSheetBackdrop
				{...props}
				appearsOnIndex={0}
				disappearsOnIndex={-1}
				opacity={0.42}
				pressBehavior='close'
			/>
		),
		[]
	);

	if (!isMounted) {
		return null;
	}

	const body = (
		// Everything inside a sheet is told so, so `AppInput` can reach for the sheet-aware
		// text input without every caller having to know it is in one.
		<IsInsideSheetProvider value={true}>
			{title ? <Header2 style={styles.title}>{title}</Header2> : null}
			{description ? (
				<Typography color={theme.colors.subtext} style={styles.description} variant='caption'>
					{description}
				</Typography>
			) : null}
			{children}
		</IsInsideSheetProvider>
	);

	return (
		<BottomSheetModal
			backdropComponent={renderBackdrop}
			backgroundStyle={{ backgroundColor: theme.colors.sheet, borderRadius: 26 }}
			enableContentPanningGesture={!hasScrollableContent}
			enableDynamicSizing={snapPoints === undefined}
			enablePanDownToClose
			handleIndicatorStyle={{ backgroundColor: theme.colors.borderStrong, width: 38, height: 4 }}
			keyboardBehavior='interactive'
			keyboardBlurBehavior='restore'
			{...(maxHeight !== undefined ? { maxDynamicContentSize: maxHeight } : {})}
			onDismiss={handleDismiss}
			ref={sheetRef}
			{...(snapPoints !== undefined ? { snapPoints } : {})}
			// A detent of `100%` measures the space below the inset, so the two together are
			// what pin the sheet's top edge exactly `topInset` points down the screen.
			{...(topInset !== undefined ? { topInset } : {})}
		>
			{hasFixedHeight ? (
				<View style={[styles.content, styles.fill, { paddingBottom }]}>{body}</View>
			) : (
				<BottomSheetView style={[styles.content, { paddingBottom }]}>{body}</BottomSheetView>
			)}
		</BottomSheetModal>
	);
};

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: 20,
		paddingTop: 4
	},
	fill: {
		flex: 1
	},
	description: {
		marginBottom: 16,
		marginTop: 6,
		maxWidth: 290
	},
	title: {
		fontSize: 21,
		marginBottom: 4
	}
});
