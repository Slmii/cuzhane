const pluginReact = require('eslint-plugin-react');
const pluginReactHooks = require('eslint-plugin-react-hooks');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
	{
		ignores: ['node_modules/**', 'dist/**', 'build/**', '.svelte-kit/**', 'package/**', 'src/declarations/**']
	},
	{
		files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				ecmaFeatures: {
					jsx: true
				}
			}
		},
		plugins: {
			react: pluginReact,
			'react-hooks': pluginReactHooks,
			'@typescript-eslint': tsPlugin
		},
		settings: {
			react: {
				version: 'detect'
			}
		},
		rules: {
			...pluginReact.configs.recommended.rules,
			...pluginReactHooks.configs.recommended.rules,
			'no-mixed-spaces-and-tabs': ['error', 'smart-tabs'],
			'linebreak-style': ['error', 'unix'],
			curly: 'error',
			'react/react-in-jsx-scope': 'off',
			'react/no-unescaped-entities': 'off',
			'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
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
