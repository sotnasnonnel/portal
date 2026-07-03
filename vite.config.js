import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { extractNf } from './server/extractNf.mjs'

const MAX_BODY = 15 * 1024 * 1024 // 15 MB

// Endpoint de DEV apenas: roda no servidor Node do Vite, lendo a chave do .env.
// Mantém GEMINI_API_KEY fora do bundle do navegador.
// Em produção, a chamada do front usa a Supabase Edge Function 'extract-nf'.
function nfExtractPlugin(env) {
  return {
    name: 'dev-extract-nf',
    configureServer(server) {
      server.middlewares.use('/api/extract-nf', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        const send = (status, obj) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
        }
        try {
          const chunks = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > MAX_BODY) return send(413, { error: 'Imagem muito grande (max 15 MB).' })
            chunks.push(chunk)
          }
          const { dataUrl } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (!dataUrl) return send(400, { error: 'dataUrl ausente.' })

          const apiKey = env.GEMINI_API_KEY
          if (!apiKey || apiKey === 'your-gemini-api-key') {
            return send(500, { error: 'GEMINI_API_KEY nao configurada no .env.' })
          }

          const data = await extractNf({ dataUrl, apiKey, model: env.GEMINI_MODEL })
          delete data._usage
          send(200, data)
        } catch (err) {
          send(500, { error: err?.message || 'Falha na extracao.' })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // '' = carrega tambem vars sem prefixo VITE_
  return {
    // base relativo: faz os assets carregarem a partir da pasta do index.html,
    // funcionando em qualquer subpasta sem precisar saber o nome dela.
    base: './',
    plugins: [react(), nfExtractPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/modules/solic'),
      },
    },
  }
})
