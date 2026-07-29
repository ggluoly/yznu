const NOTION_API_VERSION = '2026-03-11'
const MAX_REQUEST_BYTES = 2 * 1024
const MAX_TEXT_LENGTHS = {
  page: 200,
  language: 30,
  timezone: 100,
  device: 20,
  studentNumber: 64,
}
const DEVICE_TYPES = new Set(['桌面端', '平板', '移动端', '未知'])
const EVENT_TYPES = new Set(['页面加载', '历史恢复'])
const BOT_USER_AGENT = /bot|crawler|spider|preview|prerender|headless|facebookexternalhit|slurp|bingpreview/i

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
})

const jsonResponse = (data, status, origin) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      ...(origin ? corsHeaders(origin) : {}),
    },
  })

const emptyResponse = (status, origin) =>
  new Response(null, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(origin ? corsHeaders(origin) : {}),
    },
  })

const allowedOrigins = (env) =>
  (env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

const isAllowedOrigin = (origin, env) => allowedOrigins(env).includes(origin)

const limitText = (value, maximum) =>
  typeof value === 'string' ? value.trim().slice(0, maximum) : ''

const getReferrerHost = (value) => {
  try {
    return value ? new URL(value).hostname.slice(0, 200) : ''
  } catch {
    return ''
  }
}

const getRetentionDate = (visitedAt, retentionDays) => {
  const date = new Date(visitedAt)
  const days = Number.parseInt(retentionDays ?? '90', 10)
  date.setUTCDate(date.getUTCDate() + (Number.isFinite(days) && days > 0 ? days : 90))
  return date.toISOString().slice(0, 10)
}

const richText = (content) => ({
  rich_text: content
    ? [
        {
          type: 'text',
          text: { content },
        },
      ]
    : [],
})

const getNotionText = (property) => {
  if (!property) return ''
  if (property.type === 'title') return property.title.map((item) => item.plain_text).join('').trim()
  if (property.type === 'rich_text') return property.rich_text.map((item) => item.plain_text).join('').trim()
  if (property.type === 'select') return property.select?.name?.trim() ?? ''
  if (property.type === 'status') return property.status?.name?.trim() ?? ''
  return ''
}

const isPublished = (property) => {
  if (!property) return false
  if (property.type === 'checkbox') return property.checkbox === true
  return ['已发布', 'published', 'publish', '发布'].includes(getNotionText(property).toLowerCase())
}

const sha256Bytes = async (value) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))

const sha256Hex = async (value) =>
  Array.from(await sha256Bytes(value), (byte) => byte.toString(16).padStart(2, '0')).join('')

const constantTimeEqual = async (first, second) => {
  const firstHash = await sha256Bytes(first)
  const secondHash = await sha256Bytes(second)
  let difference = 0

  for (let index = 0; index < firstHash.length; index += 1) {
    difference |= firstHash[index] ^ secondHash[index]
  }

  return difference === 0
}

const buildNotionPayload = (visit, retentionDays) => ({
  parent: {
    type: 'data_source_id',
    data_source_id: visit.dataSourceId,
  },
  properties: {
    记录名称: {
      title: [
        {
          type: 'text',
          text: {
            content: `${visit.eventType} ${visit.visitedAt.slice(0, 19).replace('T', ' ')} · ${visit.page}`,
          },
        },
      ],
    },
    访问时间: {
      date: { start: visit.visitedAt },
    },
    'IP 地址': richText(visit.ip),
    页面路径: richText(visit.page),
    来源域名: richText(visit.referrerHost),
    设备类型: {
      select: { name: visit.device },
    },
    浏览器语言: richText(visit.language),
    时区: richText(visit.timezone),
    国家地区: richText(visit.country),
    访问方式: {
      select: { name: visit.eventType },
    },
    学生姓名: richText(visit.studentName ?? ''),
    风险标记: {
      checkbox: false,
    },
    数据保留截止日: {
      date: { start: getRetentionDate(visit.visitedAt, retentionDays) },
    },
  },
})

const retryOrAcknowledge = (message, responseStatus) => {
  if (responseStatus === 429 || responseStatus >= 500) {
    message.retry()
    return
  }

  message.ack()
}

const writeVisitToNotion = async (visit, env) => {
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_VISITOR_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION,
    },
    body: JSON.stringify(buildNotionPayload(visit, env.RETENTION_DAYS)),
  })

  if (!response.ok) {
    const message = await response.text()
    console.error(`Notion API returned ${response.status}: ${message}`)
  }

  return response.status
}

const parseVisit = (input, request, env) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const page = limitText(input.page, MAX_TEXT_LENGTHS.page)
  const language = limitText(input.language, MAX_TEXT_LENGTHS.language)
  const timezone = limitText(input.timezone, MAX_TEXT_LENGTHS.timezone)
  const device = limitText(input.device, MAX_TEXT_LENGTHS.device)
  const eventType = limitText(input.eventType, MAX_TEXT_LENGTHS.device)

  if (!page.startsWith('/') || page.startsWith('//')) return null
  if (!DEVICE_TYPES.has(device) || !EVENT_TYPES.has(eventType)) return null

  return {
    dataSourceId: env.NOTION_VISITOR_DATA_SOURCE_ID,
    visitedAt: new Date().toISOString(),
    ip: request.headers.get('CF-Connecting-IP')?.slice(0, 64) ?? '',
    page,
    referrerHost: getReferrerHost(request.headers.get('Referer')),
    device,
    language,
    timezone,
    country: typeof request.cf?.country === 'string' ? request.cf.country.slice(0, 10) : '',
    eventType,
  }
}

const notionStudentRequest = async (env, body) => {
  const response = await fetch(
    `https://api.notion.com/v1/data_sources/${encodeURIComponent(env.NOTION_STUDENT_DATA_SOURCE_ID)}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.NOTION_STUDENT_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION,
      },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    console.error(`Student data API returned ${response.status}: ${await response.text()}`)
    throw new Error('Student data unavailable')
  }

  return response.json()
}

const findLetterRecord = async (letterKey, env) => {
  let cursor

  do {
    const response = await notionStudentRequest(env, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    })

    for (const page of response.results) {
      if (!isPublished(page.properties['发布状态'])) continue
      const pageKey = (await sha256Hex(page.id)).slice(0, 32)
      if (pageKey !== letterKey) continue

      const name = getNotionText(page.properties['姓名'])
      const studentNumber = getNotionText(page.properties['学号'])
      const letter = getNotionText(page.properties['信件正文'])
      return name && studentNumber && letter ? { name, studentNumber, letter } : null
    }

    cursor = response.has_more ? response.next_cursor : undefined
  } while (cursor)

  return null
}

const parseLetterRequest = (input, request, env) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const letterKey = limitText(input.letterKey, 32).toLowerCase()
  const studentNumber = limitText(input.studentNumber, MAX_TEXT_LENGTHS.studentNumber)
  const page = limitText(input.page, MAX_TEXT_LENGTHS.page)
  const language = limitText(input.language, MAX_TEXT_LENGTHS.language)
  const timezone = limitText(input.timezone, MAX_TEXT_LENGTHS.timezone)
  const device = limitText(input.device, MAX_TEXT_LENGTHS.device)

  if (!/^[a-f0-9]{32}$/.test(letterKey) || !studentNumber) return null
  if (!page.startsWith('/') || page.startsWith('//') || !DEVICE_TYPES.has(device)) return null

  return {
    letterKey,
    studentNumber,
    visit: {
      dataSourceId: env.NOTION_VISITOR_DATA_SOURCE_ID,
      visitedAt: new Date().toISOString(),
      ip: request.headers.get('CF-Connecting-IP')?.slice(0, 64) ?? '',
      page,
      referrerHost: getReferrerHost(request.headers.get('Referer')),
      device,
      language,
      timezone,
      country: typeof request.cf?.country === 'string' ? request.cf.country.slice(0, 10) : '',
      eventType: '信件解锁',
    },
  }
}

const readJsonBody = async (request, origin) => {
  const contentLength = Number(request.headers.get('Content-Length') ?? 0)
  if (contentLength > MAX_REQUEST_BYTES) return { response: jsonResponse({ error: 'Request too large' }, 413, origin) }

  try {
    const body = await request.text()
    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
      return { response: jsonResponse({ error: 'Request too large' }, 413, origin) }
    }
    return { input: JSON.parse(body) }
  } catch {
    return { response: jsonResponse({ error: 'Invalid JSON' }, 400, origin) }
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? ''
    const url = new URL(request.url)

    if (allowedOrigins(env).length === 0) {
      return jsonResponse({ error: 'Allowed site origin is not configured' }, 503)
    }

    if (!isAllowedOrigin(origin, env)) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    if (request.method === 'OPTIONS') {
      return emptyResponse(204, origin)
    }

    if (request.method !== 'POST' || !['/api/visit', '/api/letter/unlock'].includes(url.pathname)) {
      return jsonResponse({ error: 'Not found' }, 404, origin)
    }

    if (!env.NOTION_VISITOR_TOKEN || !env.NOTION_VISITOR_DATA_SOURCE_ID) {
      return jsonResponse({ error: 'Visitor recorder is not configured' }, 503, origin)
    }

    if (BOT_USER_AGENT.test(request.headers.get('User-Agent') ?? '')) {
      return emptyResponse(204, origin)
    }

    const rateLimitKey = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const rateLimiter = url.pathname === '/api/letter/unlock' ? env.LETTER_RATE_LIMITER : env.VISIT_RATE_LIMITER
    const rateLimit = await rateLimiter.limit({ key: rateLimitKey })
    if (!rateLimit.success) {
      return jsonResponse({ error: 'Too many requests' }, 429, origin)
    }

    const bodyResult = await readJsonBody(request, origin)
    if (bodyResult.response) return bodyResult.response

    if (url.pathname === '/api/letter/unlock') {
      if (!env.NOTION_STUDENT_TOKEN || !env.NOTION_STUDENT_DATA_SOURCE_ID) {
        return jsonResponse({ error: 'Letter service is not configured' }, 503, origin)
      }

      const letterRequest = parseLetterRequest(bodyResult.input, request, env)
      if (!letterRequest) return jsonResponse({ error: 'Invalid request' }, 400, origin)

      try {
        const record = await findLetterRecord(letterRequest.letterKey, env)
        const valid = record && (await constantTimeEqual(letterRequest.studentNumber, record.studentNumber))
        if (!valid) return jsonResponse({ error: 'Invalid credentials' }, 401, origin)

        await env.VISIT_QUEUE.send({ ...letterRequest.visit, studentName: record.name })
        return jsonResponse({ success: true, studentName: record.name, letter: record.letter }, 200, origin)
      } catch {
        return jsonResponse({ error: 'Letter service unavailable' }, 503, origin)
      }
    }

    const visit = parseVisit(bodyResult.input, request, env)
    if (!visit) {
      return jsonResponse({ error: 'Invalid visit payload' }, 400, origin)
    }

    await env.VISIT_QUEUE.send(visit)
    return emptyResponse(202, origin)
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const status = await writeVisitToNotion(message.body, env)
        retryOrAcknowledge(message, status)
      } catch (error) {
        console.error(`Notion request failed: ${error instanceof Error ? error.message : String(error)}`)
        message.retry()
      }
    }
  },
}
