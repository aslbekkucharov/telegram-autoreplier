import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },

    build: {
        ssr: true,
        target: 'node22',
        lib: {
            formats: ['es', 'cjs'],
            name: 'telegram-autoreplier',
            entry: path.resolve(__dirname, './src/main.ts')
        },
        rollupOptions: {
            external: [
                'stream', 'fs', 'os', 'net', 'tls', 'dns'
            ]
        },
        outDir: 'build'
    }
})