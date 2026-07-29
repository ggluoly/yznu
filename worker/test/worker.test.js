import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import worker from '../src/index.js'

const allowedOrigin = 'https://graduates.example.edu.cn'

const createEnv = () => {
  const messages = []

  return {
    env: {
      ALLOWED_ORIGIN: allowedOrigin,
      RETENTION_DAYS: '90',
      NOTION_VISITOR_TOKEN: 'worker-secret',
      NOTION_VISITOR_DATA_SOURCE_ID: '8f58fd9d-240e-431c-a82c-86a24245ba75',
      NOTION_STUDENT_TOKEN: 'student-reader-secret',
      NOTION_STUDENT_DATA_SOURCE_ID: '16d3f47a-c52a-4dfb-9585-ffdb3246de5b',
      VISIT_RATE_LIMITER: {
        limit: async () => ({ success: true }),
      },
      LETTER_RATE_LIMITER: {
        limit: async () => ({ success: true }),
      },
      VISIT_QUEUE: {
        send: async (message) => messages.push(message),
      },
    },
    messages,
  }
}

const createVisitRequest = (overrides = {}) =>
  new Request('https://visitor-api.example.edu.cn/api/visit', {
    method: 'POST',
    headers: {
      Origin: allowedOrigin,
      Referer: 'https://referrer.example/path?private=value',
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.8',
      'User-Agent': 'Mozilla/5.0',
      ...overrides.headers,
    },
    body: JSON.stringify({
      page: '/yznu/',
      language: 'zh-CN',
      timezone: 'Asia/Shanghai',
      device: '桌面端',
      eventType: '页面加载',
      ...overrides.body,
    }),
  })

const studentPageId = '11111111-2222-3333-4444-555555555555'
const letterKey = createHash('sha256').update(studentPageId).digest('hex').slice(0, 32)
const studentNumber = '20170001'
const letterBody = '愿你始终保有求知的热忱，在更广阔的天地里笃定前行。'

const createLetterRequest = (overrides = {}) =>
  new Request('https://visitor-api.example.edu.cn/api/letter/unlock', {
    method: 'POST',
    headers: {
      Origin: allowedOrigin,
      Referer: 'https://graduates.example.edu.cn/',
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.8',
      'User-Agent': 'Mozilla/5.0',
      ...overrides.headers,
    },
    body: JSON.stringify({
      letterKey,
      studentNumber,
      page: '/',
      language: 'zh-CN',
      timezone: 'Asia/Shanghai',
      device: '桌面端',
      ...overrides.body,
    }),
  })

const notionStudentResponse = () => ({
  results: [
    {
      id: studentPageId,
      properties: {
        姓名: {
          type: 'title',
          title: [{ plain_text: '张同学' }],
        },
        学号: {
          type: 'rich_text',
          rich_text: [{ plain_text: studentNumber }],
        },
        信件正文: {
          type: 'rich_text',
          rich_text: [{ plain_text: letterBody }],
        },
        信件留名: {
          type: 'rich_text',
          rich_text: [{ plain_text: '计算机学院教师团队' }],
        },
        发布状态: {
          type: 'select',
          select: { name: '已发布' },
        },
      },
    },
  ],
  has_more: false,
  next_cursor: null,
})

test('queues one real browser page-load visit with the Cloudflare IP', async () => {
  const { env, messages } = createEnv()
  const response = await worker.fetch(createVisitRequest(), env)

  assert.equal(response.status, 202)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin)
  assert.equal(messages.length, 1)
  assert.equal(messages[0].ip, '203.0.113.8')
  assert.equal(messages[0].referrerHost, 'referrer.example')
  assert.match(messages[0].visitedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
})

test('rejects a request from an unapproved origin', async () => {
  const { env, messages } = createEnv()
  const response = await worker.fetch(
    createVisitRequest({ headers: { Origin: 'https://untrusted.example' } }),
    env,
  )

  assert.equal(response.status, 403)
  assert.equal(messages.length, 0)
})

test('requires the site origin to be configured at runtime', async () => {
  const { env, messages } = createEnv()
  delete env.ALLOWED_ORIGIN

  const response = await worker.fetch(createVisitRequest(), env)

  assert.equal(response.status, 503)
  assert.equal(messages.length, 0)
})

test('does not queue known bot user agents', async () => {
  const { env, messages } = createEnv()
  const response = await worker.fetch(
    createVisitRequest({ headers: { 'User-Agent': 'Googlebot/2.1' } }),
    env,
  )

  assert.equal(response.status, 204)
  assert.equal(messages.length, 0)
})

test('writes the queued IP address to Notion', async () => {
  const { env, messages } = createEnv()
  await worker.fetch(createVisitRequest(), env)

  const acknowledgements = []
  const originalFetch = globalThis.fetch
  let notionPayload

  globalThis.fetch = async (_url, options) => {
    notionPayload = JSON.parse(options.body)
    return new Response('{}', { status: 200 })
  }

  try {
    await worker.queue(
      {
        messages: [
          {
            body: messages[0],
            ack: () => acknowledgements.push('ack'),
            retry: () => acknowledgements.push('retry'),
          },
        ],
      },
      env,
    )
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(acknowledgements.join(','), 'ack')
  assert.equal(notionPayload.properties['IP 地址'].rich_text[0].text.content, '203.0.113.8')
})

test('unlocks a published student letter and queues only the student name', async () => {
  const { env, messages } = createEnv()
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () =>
    new Response(JSON.stringify(notionStudentResponse()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  let response
  try {
    response = await worker.fetch(createLetterRequest(), env)
  } finally {
    globalThis.fetch = originalFetch
  }

  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal(result.studentName, '张同学')
  assert.equal(result.letter, letterBody)
  assert.equal(result.signoff, '计算机学院教师团队')
  assert.equal(messages.length, 1)
  assert.equal(messages[0].eventType, '信件解锁')
  assert.equal(messages[0].studentName, '张同学')
  assert.match(messages[0].visitedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.equal('studentNumber' in messages[0], false)
  assert.equal('letter' in messages[0], false)
})

test('rejects an incorrect student number without queuing a visit', async () => {
  const { env, messages } = createEnv()
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () =>
    new Response(JSON.stringify(notionStudentResponse()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  let response
  try {
    response = await worker.fetch(
      createLetterRequest({ body: { studentNumber: 'wrong-number' } }),
      env,
    )
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(response.status, 401)
  assert.equal(messages.length, 0)
})

test('uses the school name when the letter signoff is empty', async () => {
  const { env } = createEnv()
  const responseData = notionStudentResponse()
  responseData.results[0].properties.信件留名.rich_text = []
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () =>
    new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  let response
  try {
    response = await worker.fetch(createLetterRequest(), env)
  } finally {
    globalThis.fetch = originalFetch
  }

  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.signoff, '长江师范学院')
})

test('applies the dedicated letter rate limiter', async () => {
  const { env, messages } = createEnv()
  env.LETTER_RATE_LIMITER.limit = async () => ({ success: false })

  const response = await worker.fetch(createLetterRequest(), env)

  assert.equal(response.status, 429)
  assert.equal(messages.length, 0)
})

test('writes the unlocked student name to the visitor data source', async () => {
  const { env } = createEnv()
  const acknowledgements = []
  const originalFetch = globalThis.fetch
  let notionPayload

  globalThis.fetch = async (_url, options) => {
    notionPayload = JSON.parse(options.body)
    return new Response('{}', { status: 200 })
  }

  try {
    await worker.queue(
      {
        messages: [
          {
            body: {
              dataSourceId: env.NOTION_VISITOR_DATA_SOURCE_ID,
              visitedAt: '2026-07-28 18:00:00',
              ip: '203.0.113.8',
              page: '/',
              referrerHost: '',
              device: '桌面端',
              language: 'zh-CN',
              timezone: 'Asia/Shanghai',
              country: 'CN',
              eventType: '信件解锁',
              studentName: '张同学',
            },
            ack: () => acknowledgements.push('ack'),
            retry: () => acknowledgements.push('retry'),
          },
        ],
      },
      env,
    )
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(acknowledgements.join(','), 'ack')
  assert.equal(notionPayload.properties['学生姓名'].rich_text[0].text.content, '张同学')
  assert.equal(notionPayload.properties['访问方式'].select.name, '信件解锁')
  assert.equal(notionPayload.properties['访问时间'].rich_text[0].text.content, '2026-07-28 18:00:00')
  assert.equal(notionPayload.properties['数据保留截止日'].date.start, '2026-10-26')
  assert.equal(JSON.stringify(notionPayload).includes(studentNumber), false)
})
