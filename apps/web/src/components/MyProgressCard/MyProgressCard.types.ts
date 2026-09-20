import type { MyProgress } from '@/lib/types/domain';

export interface MyProgressCardProps {
	progress: MyProgress;
	onPress: () => void;
}
