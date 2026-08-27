import { OK } from '@config/httpCodes';
import { Router } from 'express';

const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
	res.status(OK).json({ status: 'ok' });
});

export default healthRouter;
