import { wrapperApi } from '@/api/wrapper.api';

export const deleteAccount = async () => wrapperApi<{ success: boolean }>('/account', { method: 'DELETE' });
