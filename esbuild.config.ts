import { build } from 'esbuild'

void build({
    entryPoints: ['src/pipeline/load-configs/src/handler.ts'],
    bundle: true,
    platform: 'node',
    target: 'node24',
    outfile: 'dist/pipeline/load-configs/handler.js',
    minify: true,
    sourcemap: false,
    external: ['aws-sdk'],
})
    .then(() => {
        console.log('[esbuild] Build complete → dist/pipeline/load-configs/handler.js')
    })
    .catch((err: unknown) => {
        console.error('[esbuild] Build failed:', err)
        process.exit(1)
    })
