const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
	{
		// `src/generated/**` is the Prisma client — regenerated on every `db:generate`,
		// so linting it only ever produces noise about code we don't own.
		ignores: [
			'node_modules/**',
			'dist/**',
			'build/**',
			'.svelte-kit/**',
			'package/**',
			'src/declarations/**',
			'src/generated/**'
		]
	},
	{
		files: ['**/*.{js,mjs,cjs,ts}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module'
			}
		},
		plugins: {
			'@typescript-eslint': tsPlugin
		},
		rules: {
			'no-mixed-spaces-and-tabs': ['error', 'smart-tabs'],
			'linebreak-style': ['error', 'unix'],
			curly: 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					args: 'all',
					caughtErrors: 'none',
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					ignoreRestSiblings: true
				}
			]
		}
	}
];
