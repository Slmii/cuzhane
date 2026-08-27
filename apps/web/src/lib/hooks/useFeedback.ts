import { createFeedback } from '@/api/feedback.api';
import { useMutation } from '@tanstack/react-query';

/**
 * Nothing in the app reads feedback back, so there is no cache to invalidate — the
 * mutation's own state is the whole thank-you screen.
 */
export const useSendFeedback = () => useMutation({ mutationFn: createFeedback });
