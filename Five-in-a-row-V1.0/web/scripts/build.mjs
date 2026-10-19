// Use the framework build APIs and let Node drain its event loop naturally.
// The pinned vinext CLI calls process.exit(0) while native Vite handles close,
// triggering a libuv UV_HANDLE_CLOSING assertion on Windows / Node 24.
// Errors from compilation and static prerendering remain fatal.
import { randomBytes } from 'node:crypto';
import { access, lstat, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
process.env.NODE_ENV = 'production';
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = projectRoot.replaceAll('\\', '/');
try {
  if (resolve(process.cwd()) !== projectRoot) throw new Error('Run the build from the web project directory.');
  const generated = resolve(projectRoot, 'dist');
  if (generated.replaceAll('\\', '/') !== root + '/dist') throw new Error('Invalid build output path.');
  const existing = await lstat(generated).catch(error => { if(error.code === 'ENOENT') return null; throw error; });
  if (existing?.isSymbolicLink()) throw new Error('Build output must not be a symlink.');
  // Only this script-owned, validated output directory is disposable.
  if (existing) await rm(generated, { recursive:true, force:true });
  const { createBuilder } = await import('vite');
  const {
    loadNextConfig,
    resolveNextConfig,
    createRscCompatibilityId,
    PHASE_PRODUCTION_BUILD,
  } = await import('vinext/internal/config/next-config');
  const { runPrerender } = await import('vinext/internal/build/run-prerender');
  const config = await resolveNextConfig(
    await loadNextConfig(root, PHASE_PRODUCTION_BUILD),
    root,
  );
  process.env.__VINEXT_SHARED_BUILD_ID = config.buildId;
  process.env.__VINEXT_SHARED_RSC_COMPATIBILITY_ID =
    createRscCompatibilityId(config);
  process.env.__VINEXT_SHARED_REVALIDATE_SECRET =
    randomBytes(32).toString('hex');
  const builder = await createBuilder({ root, mode: 'production' });
  await builder.buildApp();
  const result = await runPrerender({
    root,
    nextConfig: config,
    concurrency: 1,
  });
  if (!result || result.routes.some((r) => r.status === 'error'))
    throw new Error('Static prerender did not finish successfully.');
  await access(root + '/dist/client/index.html');
  console.log('弈间网页构建完成。运行 pnpm start 即可开始局域网对弈。');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
