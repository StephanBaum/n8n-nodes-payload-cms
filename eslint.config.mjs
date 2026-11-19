import { n8nCommunityNodesPlugin } from '@n8n/eslint-plugin-community-nodes';
import tseslint from 'typescript-eslint';

export default [
	{
		ignores: ['dist/**', 'node_modules/**', 'scripts/**', 'test/**', '*.js', '*.mjs'],
	},
	...tseslint.configs.recommended.map((config) => ({
		...config,
		files: ['**/*.ts'],
	})),
	n8nCommunityNodesPlugin.configs.recommended,
];
