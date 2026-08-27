import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Field } from '@/components/ui/Form/Field/Field.component';
import { Form } from '@/components/ui/Form/Form.component';
import { Select } from '@/components/ui/Form/Select/Select.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, Header2, MonoText } from '@/components/ui/Typography/Typography.component';
import { useSendFeedback } from '@/lib/hooks/useFeedback';
import { useTranslation } from '@/lib/i18n/I18n.context';
import {
	createFeedbackSchema,
	FEEDBACK_MESSAGE_MAX_LENGTH,
	FEEDBACK_MESSAGE_MIN_LENGTH,
	type FeedbackForm
} from '@/lib/schemas/feedback.schema';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { FeedbackSheetProps } from './FeedbackSheet.types';

const MESSAGE_MIN_HEIGHT = 108;
const CHECK_SIZE = 26;

/**
 * "Geliştiricilere yaz" — the whole support surface, and deliberately two questions long.
 * The design dropped the email row and the diagnostics toggle because neither was ever a
 * decision the sender should have to make: the account address and the build are attached
 * on the way out, so writing a bug report costs a topic and a sentence.
 */
export const FeedbackSheet = ({ appVersion, isVisible, locale, onClose, platform }: FeedbackSheetProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const sendFeedback = useSendFeedback();
	const feedbackSchema = useMemo(() => createFeedbackSchema(), []);
	const [reference, setReference] = useState<string | null>(null);

	/**
	 * A closed sheet forgets the last message, so reopening it is a blank form rather than
	 * the thank-you screen from an hour ago. Done here rather than in an effect watching
	 * `isVisible`: every way out — the button, the grabber, a drag, the backdrop — arrives
	 * through `AppBottomSheet`'s `onClose`, so this is the one path, and mirroring the prop
	 * into state would only cascade a render.
	 */
	const handleClose = () => {
		setReference(null);
		sendFeedback.reset();
		onClose();
	};

	if (reference) {
		return (
			<AppBottomSheet isVisible={isVisible} onClose={handleClose} title={t('feedbackTitle')}>
				<View style={styles.sent}>
					<View style={[styles.sentMark, { backgroundColor: theme.colors.accentSoft }]}>
						<Icon color={theme.colors.accent} name='check' size={CHECK_SIZE} strokeWidth={1.9} />
					</View>
					<Header2 style={styles.sentTitle} textAlign='center'>
						{t('feedbackSentTitle')}
					</Header2>
					<CaptionText color={theme.colors.subtext} style={styles.sentBody} textAlign='center'>
						{t('feedbackSentBody')}
					</CaptionText>
					{/* The one handle the sender is given — mono so it can be read back a
					    character at a time, and the `#` is punctuation the screen adds. */}
					<MonoText color={theme.colors.subtext} style={styles.sentReference}>
						{`${t('sentTicket')} #${reference}`}
					</MonoText>
					<AppButton onPress={handleClose} style={styles.sentClose} title={t('close')} variant='surface' />
				</View>
			</AppBottomSheet>
		);
	}

	return (
		<AppBottomSheet
			description={t('feedbackHint')}
			hasScrollableContent
			isVisible={isVisible}
			onClose={handleClose}
			title={t('feedbackTitle')}
		>
			<Form<FeedbackForm>
				defaultValues={{ topic: 'BUG', message: '' }}
				isFullHeight={false}
				render={({ handleSubmit, watch }) => {
					const topic = watch('topic');
					const message = watch('message') ?? '';
					const isLongEnough = message.trim().length >= FEEDBACK_MESSAGE_MIN_LENGTH;
					const placeholderKey =
						topic === 'BUG'
							? 'msgPlaceholderBug'
							: topic === 'IDEA'
							? 'msgPlaceholderIdea'
							: 'msgPlaceholderOther';

					const submit = handleSubmit(async values => {
						const receipt = await sendFeedback.mutateAsync({
							topic: values.topic,
							message: values.message.trim(),
							...(appVersion ? { appVersion } : {}),
							...(platform ? { platform } : {}),
							...(locale ? { locale } : {})
						});

						setReference(receipt.reference);
					});

					return (
						<>
							<Select
								name='topic'
								options={[
									{ label: t('topicBug'), value: 'BUG' },
									{ label: t('topicIdea'), value: 'IDEA' },
									{ label: t('topicOther'), value: 'OTHER' }
								]}
								variant='filled'
							/>
							<Field
								counter={`${message.length}/${FEEDBACK_MESSAGE_MAX_LENGTH}`}
								maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
								multiline
								multilineMinHeight={MESSAGE_MIN_HEIGHT}
								name='message'
								placeholder={t(placeholderKey)}
							/>
							{/* The button carries the requirement rather than an error under the
							    field: nothing has gone wrong while a message is still short. */}
							<AppButton
								disabled={!isLongEnough}
								isLoading={sendFeedback.isPending}
								onPress={() => void submit()}
								title={isLongEnough ? t('send') : t('sendHint')}
							/>
						</>
					);
				}}
				schema={feedbackSchema}
			/>
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	sent: {
		alignItems: 'center',
		paddingHorizontal: 6,
		paddingTop: 14
	},
	sentBody: {
		marginTop: 7,
		maxWidth: 280
	},
	sentClose: {
		marginTop: 18
	},
	sentMark: {
		alignItems: 'center',
		borderRadius: 28,
		height: 56,
		justifyContent: 'center',
		width: 56
	},
	sentReference: {
		fontSize: 11,
		marginTop: 14
	},
	sentTitle: {
		marginTop: 14
	}
});
