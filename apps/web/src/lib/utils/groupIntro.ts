import type { GroupKind } from '@/lib/types/domain';

/**
 * Which account setting holds "Yeni gruplarda bir daha gösterme" for each kind — kept apart, so
 * hiding "how the group works" for a Cevşen group still shows it for the next Kur'an or Hizb one.
 */
export const INTRO_SETTING = {
	CEVSEN: 'cevsenIntroEnabled',
	HATIM: 'hatimIntroEnabled',
	HIZB: 'hizbIntroEnabled'
} as const satisfies Record<GroupKind, string>;

export type IntroSetting = (typeof INTRO_SETTING)[GroupKind];
