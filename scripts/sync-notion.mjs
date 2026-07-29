import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

try {
  process.loadEnvFile('.env')
} catch {
  // CI environments inject secrets directly; local .env is optional.
}

const NOTION_API_VERSION = '2026-03-11'
const DATA_FILE = path.resolve('src/data/graduates.json')
const PRESET_FILE = path.resolve('src/data/content-presets.json')
const PHOTO_DIRECTORY = path.resolve('public/graduates')
const token = process.env.NOTION_TOKEN?.trim()
const dataSourceId = process.env.NOTION_DATA_SOURCE_ID?.trim().replace(/^collection:\/\//, '')
const optional = process.argv.includes('--optional')

const fail = (message) => {
  throw new Error(message)
}

const contentPresets = JSON.parse(await readFile(PRESET_FILE, 'utf8'))

const validatePresets = (values, label) => {
  if (!Array.isArray(values) || values.length !== 10 || values.some((value) => typeof value !== 'string' || !value.trim())) {
    fail(`${label} must contain exactly 10 non-empty strings.`)
  }

  return values
}

const honorPresets = validatePresets(contentPresets.honors, 'Honor presets')
const messagePresets = validatePresets(contentPresets.messages, 'Message presets')

const getPreset = (values, seed) => {
  let hash = 2166136261

  for (const character of seed) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  }

  return values[(hash >>> 0) % values.length]
}

const getLetterKey = (pageId) => createHash('sha256').update(pageId).digest('hex').slice(0, 32)

const notionRequest = async (body) => {
  const response = await fetch(
    `https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION,
      },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    const message = await response.text()
    fail(`Notion API returned ${response.status}: ${message}`)
  }

  return response.json()
}

const getText = (property) => {
  if (!property) return ''

  if (property.type === 'title') {
    return property.title.map((item) => item.plain_text).join('').trim()
  }

  if (property.type === 'rich_text') {
    return property.rich_text.map((item) => item.plain_text).join('').trim()
  }

  if (property.type === 'select') {
    return property.select?.name?.trim() ?? ''
  }

  if (property.type === 'status') {
    return property.status?.name?.trim() ?? ''
  }

  return ''
}

const isPublished = (property) => {
  if (!property) return false
  if (property.type === 'checkbox') return property.checkbox === true

  const value = getText(property).toLowerCase()
  return ['已发布', 'published', 'publish', '发布'].includes(value)
}

const getPhoto = (property) => {
  if (!property || property.type !== 'files' || property.files.length === 0) return null

  const file = property.files[0]
  const url = file.type === 'file' ? file.file.url : file.external.url
  return { name: file.name, url }
}

const getExtension = (photoName, contentType) => {
  const extension = path.extname(photoName).toLowerCase()
  const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])

  if (allowedExtensions.has(extension)) return extension === '.jpeg' ? '.jpg' : extension

  const extensionsByType = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/avif': '.avif',
  }

  return extensionsByType[contentType] ?? null
}

const downloadPhoto = async (photo, index, name) => {
  const photoUrl = new URL(photo.url)
  if (photoUrl.protocol !== 'https:') fail(`Photo URL for ${name} must use HTTPS.`)

  const response = await fetch(photo.url)

  if (!response.ok) {
    fail(`Failed to download photo for ${name}: HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type')?.split(';')[0] ?? ''
  const extension = getExtension(photo.name, contentType)
  if (!extension) fail(`Unsupported photo format for ${name}: ${contentType || photo.name}`)

  const buffer = Buffer.from(await response.arrayBuffer())
  const maxPhotoSize = 5 * 1024 * 1024
  if (buffer.byteLength > maxPhotoSize) fail(`Photo for ${name} exceeds 5 MiB.`)

  const filename = `${String(index + 1).padStart(2, '0')}${extension}`
  await writeFile(path.join(PHOTO_DIRECTORY, filename), buffer)
  return `graduates/${filename}`
}

const main = async () => {
  if (!token && !dataSourceId) {
    if (optional) {
      console.log('[notion-sync] Notion is not configured; using repository fallback data.')
      return
    }

    fail('Missing NOTION_TOKEN or NOTION_DATA_SOURCE_ID.')
  }

  if (!token || !dataSourceId) {
    fail('NOTION_TOKEN and NOTION_DATA_SOURCE_ID must be configured together.')
  }

  const pages = []
  let cursor

  do {
    const response = await notionRequest({
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    })

    pages.push(...response.results)
    cursor = response.has_more ? response.next_cursor : undefined
  } while (cursor)

  const publishedPages = pages
    .filter((page) => isPublished(page.properties['发布状态']))
    .sort((first, second) => {
      const firstOrder = first.properties['排序']?.number ?? Number.MAX_SAFE_INTEGER
      const secondOrder = second.properties['排序']?.number ?? Number.MAX_SAFE_INTEGER
      return firstOrder - secondOrder
    })

  if (publishedPages.length === 0) {
    fail('No published graduates found in the Notion data source.')
  }

  await rm(PHOTO_DIRECTORY, { recursive: true, force: true })
  await mkdir(PHOTO_DIRECTORY, { recursive: true })

  const graduates = []
  const studentNumbers = new Set()

  for (const [index, page] of publishedPages.entries()) {
    const properties = page.properties
    const name = getText(properties['姓名'])
    const college = getText(properties['学院'])
    const major = getText(properties['专业'])
    const honor = getText(properties['荣誉称号']) || getPreset(honorPresets, `${page.id}:honor`)
    const message = getText(properties['寄语']) || getPreset(messagePresets, `${page.id}:message`)
    const studentNumber = getText(properties['学号'])
    const letterBody = getText(properties['信件正文'])
    const portraitAuthorized = properties['肖像授权']?.type === 'checkbox' && properties['肖像授权'].checkbox
    const photo = portraitAuthorized ? getPhoto(properties['照片']) : null

    if (!name) {
      fail(`Published record ${page.id} is missing 姓名.`)
    }

    if (letterBody && !studentNumber) {
      fail(`Published student ${name} has 信件正文 but no 学号.`)
    }

    if (studentNumber) {
      if (studentNumbers.has(studentNumber)) {
        fail(`Duplicate 学号 found for published student ${name}.`)
      }
      studentNumbers.add(studentNumber)
    }

    const department = [college, major].filter(Boolean).join(' · ') || '长江师范学院 · 2017届'
    const localPhoto = photo ? await downloadPhoto(photo, index, name) : null

    graduates.push({
      number: String(index + 1).padStart(2, '0'),
      name,
      department,
      honor,
      message,
      photo: localPhoto,
      photoAlt: localPhoto ? `${name}纪念照片` : null,
      letterKey: letterBody ? getLetterKey(page.id) : null,
    })
  }

  await writeFile(DATA_FILE, `${JSON.stringify(graduates, null, 2)}\n`, 'utf8')
  console.log(`[notion-sync] Synced ${graduates.length} published graduates.`)
}

void main().catch((error) => {
  console.error(`[notion-sync] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
