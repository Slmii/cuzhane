import type { WeekDay } from '@/lib/utils/weekStrip';

export interface HomeHeaderProps {
	/** "Selâm, Elif" — or "Hoş geldin" before there is a group. */
	greeting: string;
	/** "Bugün 3 görev kaldı", "Bugün tamam", "Bugün görev yok" — none while there is no list to read. */
	title: string | null;
	/** The compact streak; absent before there is a group, and while the stats are unknown. */
	streak?: { days: number; week: WeekDay[] };
}
