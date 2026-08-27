import { DangerButton } from '@/components/ui/DangerButton/DangerButton.component';
import { useEffect, useRef, useState } from 'react';
import type { DangerConfirmButtonProps } from './DangerConfirmButton.types';

/** Long enough to read the question, short enough that a stray tap can't arm it for later. */
const CONFIRM_RESET_MS = 4000;

/**
 * The design's two-step destructive action: the first tap turns the button into its own
 * confirmation ("Emin misin? Dokun ve sil") and fills it with the danger colour, and the
 * second commits. No modal — the button *is* the dialog, which is why it also arms itself
 * back down after a few seconds rather than waiting for a cancel.
 *
 * Used where the action already sits behind a deliberate step, like the manage sheet an
 * owner had to open. Actions reachable straight from a screen use the platform dialog
 * instead, so a mis-tap can't be completed by a second mis-tap.
 */
export const DangerConfirmButton = ({
	confirmLabel,
	hint,
	isDisabled = false,
	label,
	onConfirm,
	style
}: DangerConfirmButtonProps) => {
	const [isConfirming, setIsConfirming] = useState(false);
	const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (resetTimeoutRef.current) {
				clearTimeout(resetTimeoutRef.current);
			}
		},
		[]
	);

	const handlePress = () => {
		if (!isConfirming) {
			setIsConfirming(true);
			resetTimeoutRef.current = setTimeout(() => setIsConfirming(false), CONFIRM_RESET_MS);
			return;
		}

		if (resetTimeoutRef.current) {
			clearTimeout(resetTimeoutRef.current);
		}

		onConfirm();
	};

	return (
		<DangerButton
			hint={hint}
			isDisabled={isDisabled}
			isFilled={isConfirming}
			label={isConfirming ? confirmLabel : label}
			onPress={handlePress}
			style={style}
		/>
	);
};
