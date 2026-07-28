import assert from 'node:assert/strict'
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
      VISIT_RATE_LIMITER: {
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

test('queues one real browser page-load visit with the Cloudflare IP', async () => {
  const { env, messages } = createEnv()
  const response = await worker.fetch(createVisitRequest(), env)

  assert.equal(response.status, 202)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin)
  assert.equal(messages.length, 1)
  assert.equal(messages[0].ip, '203.0.113.8')
  assert.equal(messages[0].referrerHost, 'referrer.example')
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
