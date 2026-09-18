import express from 'express'
import { z } from 'zod'
import type { SearchEvent } from '../../shared/types.ts'
import { config } from './config.ts'
import { search } from './search.ts'

const app = express()

const searchQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(config.maxRadiusKm),
})

app.get('/api/search', async (req, res) => {
  const query = searchQuery.safeParse(req.query)
  if (!query.success) {
    res.status(400).json({ error: z.prettifyError(query.error) })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.flushHeaders()

  const send = (event: SearchEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`)
  const stopped = new AbortController()
  req.on('close', () => stopped.abort()) // the page was closed or a new search started

  try {
    await search(query.data, send, stopped.signal)
    send({ type: 'done' })
  } catch (err) {
    console.error(err)
    send({ type: 'error', message: 'Could not reach the map service. Try again in a moment.' })
  }
  res.end()
})

app.listen(config.port, () => console.log(`Backend running on http://localhost:${config.port}`))
