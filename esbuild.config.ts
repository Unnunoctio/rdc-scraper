import { build, type BuildOptions } from 'esbuild'

const shared: Omit<BuildOptions, 'entryPoints' | 'outfile'> = {
    bundle: true,
    platform: 'node',
    target: 'node24',
    minify: true,
    sourcemap: false,
    external: ['aws-sdk'],
}

const lambdas: Array<{ entry: string; out: string }> = [
    {
        entry: 'src/pipeline/load-configs/src/handler.ts',
        out: 'dist/pipeline/load-configs/handler.js',
    },
    {
        entry: 'src/spiders/jumbo/src/handler.ts',
        out: 'dist/spiders/jumbo/handler.js',
    },
]

void Promise.all(
    lambdas.map(({ entry, out }) => build({ ...shared, entryPoints: [entry], outfile: out }).then(() => console.log(`[esbuild] Built → ${out}`)))
).catch((err: unknown) => {
    console.error('[esbuild] Build failed:', err)
    process.exit(1)
})
