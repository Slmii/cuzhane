import { ResponseLocalsWithQuery } from '@interfaces/response.types';
import { validateData } from '@middleware/validate.middleware';
import { VerseTranslationQuery, VerseTranslationQuerySchema } from '@schemas/quran.schema';
import { getVerseTranslation, type VerseTranslation } from '@services/quranTranslation.service';
import { NextFunction, Request, Response, Router } from 'express';

const quranRouter = Router();

// A verse's meal in the interface language — `?verseKey=53:62&lang=tr`.
quranRouter.get(
	'/translation',
	validateData(VerseTranslationQuerySchema, 'query'),
	async (
		_req: Request,
		res: Response<VerseTranslation, ResponseLocalsWithQuery<VerseTranslationQuery>>,
		next: NextFunction
	) => {
		try {
			const { lang, verseKey } = res.locals.validatedQuery;

			res.json(await getVerseTranslation(verseKey, lang));
		} catch (error) {
			next(error);
		}
	}
);

export default quranRouter;
