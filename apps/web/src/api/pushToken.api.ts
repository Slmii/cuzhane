import { wrapperApi } from '@/api/wrapper.api';
import { PushToken } from '@/lib/types/domain';

export const registerPushToken = async (token: string) =>
	wrapperApi<PushToken>('/push-tokens', { method: 'POST', body: JSON.stringify({ token }) });

export const deletePushToken = async (token: string) =>
	wrapperApi<{ success: boolean }>('/push-tokens', { method: 'DELETE', body: JSON.stringify({ token }) });
