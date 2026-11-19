import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';

const ASSET_EXTENSIONS = new Set(['.svg', '.png', '.json']);
const SOURCE_DIRS = ['nodes', 'credentials'];

function copyAssets(currentDir) {
	for (const entry of readdirSync(currentDir)) {
		const fullPath = join(currentDir, entry);
		const stats = statSync(fullPath);

		if (stats.isDirectory()) {
			copyAssets(fullPath);
			continue;
		}

		if (ASSET_EXTENSIONS.has(extname(entry).toLowerCase())) {
			const relPath = relative(process.cwd(), fullPath);
			const targetPath = join(process.cwd(), 'dist', relPath);
			mkdirSync(dirname(targetPath), { recursive: true });
			copyFileSync(fullPath, targetPath);
		}
	}
}

for (const dir of SOURCE_DIRS) {
	copyAssets(join(process.cwd(), dir));
}
