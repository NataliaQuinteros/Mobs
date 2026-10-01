import express from 'express'
import { z } from 'zod'
import type { SearchEvent } from '../../shared/types.ts'
import { config } from './config.ts'
import { readPosting } from './postingDetails.ts'
import { search } from './search.ts'

const app = express()

const searchQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(config.maxRadiusKm),
})

// Read one posting on demand, when a business card is opened.
app.get('/api/posting', async (req, res) => {
  const url = z.url({ protocol: /^https?$/ }).safeParse(req.query.url)
  if (!url.success) {
    res.status(400).json({ error: 'A posting url is required' })
    return
  }

  const posting = await readPosting(url.data).catch(() => null)
  if (!posting) {
    res.status(502).json({ error: 'Could not open that posting' })
    return
  }
  res.json(posting)
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
