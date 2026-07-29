import './style.css'
import contentPresets from './data/content-presets.json'
import graduateData from './data/graduates.json'
import { setupGraduateLetters } from './graduate-letter'
import { setupVisitorTracking } from './visitor-tracking'

type Graduate = {
  number: string
  name: string
  department: string
  honor: string
  message: string
  photo: string | null
  photoAlt: string | null
  letterKey: string | null
}

const GRADUATION_YEAR = 2017
const HONOR_PRESETS = contentPresets.honors
const MESSAGE_PRESETS = contentPresets.messages

const assetUrl = (filename: string) => `${import.meta.env.BASE_URL}${filename}`

const getChinaYear = (date: Date) =>
  Number(
    new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      timeZone: 'Asia/Shanghai',
    }).format(date),
  )

const getCurrentYear = async () => {
  try {
    const response = await fetch(window.location.href.split('#')[0], {
      method: 'HEAD',
      cache: 'no-store',
    })
    const serverDate = response.headers.get('Date')

    if (response.ok && serverDate) {
      const networkDate = new Date(serverDate)

      if (!Number.isNaN(networkDate.getTime())) {
        return getChinaYear(networkDate)
      }
    }
  } catch {
    // Offline previews use the browser clock as a graceful fallback.
  }

  return getChinaYear(new Date())
}

const toChineseNumber = (value: number) => {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

  if (value < 10) {
    return digits[value]
  }

  if (value < 20) {
    return `十${value % 10 === 0 ? '' : digits[value % 10]}`
  }

  if (value < 100) {
    return `${digits[Math.floor(value / 10)]}十${value % 10 === 0 ? '' : digits[value % 10]}`
  }

  return String(value)
}

let activeNavigationObserver: IntersectionObserver | undefined

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }

    return entities[character]
  })

const getPreset = (values: string[], seed: string) => {
  let hash = 2166136261

  for (const character of seed) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  }

  return values[(hash >>> 0) % values.length]
}

const getDisplayText = (value: string | undefined, presets: string[], seed: string) =>
  value?.trim() || getPreset(presets, seed)

const graduates: Graduate[] = graduateData.map((graduate) => ({
  ...graduate,
  honor: getDisplayText(graduate.honor, HONOR_PRESETS, `${graduate.number}:${graduate.name}:honor`),
  message: getDisplayText(graduate.message, MESSAGE_PRESETS, `${graduate.number}:${graduate.name}:message`),
}))

const renderPage = (currentYear: number) => {
  const anniversaryYears = Math.max(0, currentYear - GRADUATION_YEAR)
  const chineseYears = toChineseNumber(anniversaryYears)
  const yearsLabel = `${chineseYears}年`
  const anniversaryLabel = `${chineseYears}周年`
  const yearRange = `${GRADUATION_YEAR} — ${currentYear}`
  const englishYears = `${anniversaryYears} ${anniversaryYears === 1 ? 'YEAR' : 'YEARS'} ON`
  const compactGrid = graduates.length > 0 && graduates.length < 3
  const graduateGridClass = compactGrid ? ' graduate-grid--compact' : ''
  const graduateGridStyle = compactGrid ? ` style="--graduate-count: ${graduates.length}"` : ''
  const graduateCards = graduates
    .map(
      ({ number, name, department, honor, message, photo, photoAlt, letterKey }) => `
      <article class="graduate-card${letterKey ? ' has-letter' : ''}">
        <div class="card-topline">
          <span class="graduate-number">${escapeHtml(number)}</span>
          <span class="card-topline-marks" aria-hidden="true">
            ${letterKey ? '<span class="card-letter-badge">一封信</span>' : ''}
            <span class="card-mark"></span>
          </span>
        </div>
        <div class="portrait${photo ? ' has-photo' : ''}">
          ${
            photo
              ? `<img src="${escapeHtml(assetUrl(photo))}" alt="${escapeHtml(photoAlt || `${name}纪念照片`)}" loading="lazy" decoding="async" />`
              : `<span aria-label="毕业年份纪念徽章">${GRADUATION_YEAR}</span>`
          }
        </div>
        <p class="card-honor">${escapeHtml(honor)}</p>
        <h3>${escapeHtml(name)}</h3>
        <p class="card-department">${escapeHtml(department)}</p>
        <p class="card-message">${escapeHtml(message)}</p>
        ${
          letterKey
            ? `<button class="graduate-letter-trigger" type="button" data-letter-key="${escapeHtml(letterKey)}" data-student-name="${escapeHtml(name)}" aria-label="打开给${escapeHtml(name)}同学的一封信"></button>`
            : ''
        }
      </article>`,
    )
    .join('')

  document.title = `2017届优秀毕业生${anniversaryLabel}纪念 | 长江师范学院`
  document
    .querySelector<HTMLMetaElement>('meta[name="description"]')
    ?.setAttribute('content', `长江师范学院2017届优秀毕业生${anniversaryLabel}纪念展示页`)
  document.documentElement.dataset.currentYear = String(currentYear)
  activeNavigationObserver?.disconnect()

  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <header class="site-header">
    <div class="wrapper head" id="head">
      <div class="inner">
        <div class="mod">
          <div class="head-left">
            <div class="sitelogo">
              <a href="#home" title="返回页面顶部">
                <img src="${assetUrl('yznu-logo.png')}" alt="长江师范学院" />
              </a>
              <span class="xx">
                <img src="${assetUrl('yznu-xx.png')}" alt="长江师范学院校训" />
              </span>
            </div>
          </div>
          <div class="head-right">
            <nav class="anniversary-nav" aria-label="纪念页面导航">
              <ul>
                <li class="links i1 is-current"><a href="#home" aria-current="location">首页</a></li>
                <li class="links i2"><a href="#honor-roll">优秀毕业生</a></li>
                <li class="links i3"><a href="#memory">${yearsLabel}回望</a></li>
                <li class="links i4"><a href="#tribute">致敬寄语</a></li>
                <li class="links i5"><a href="https://www.yznu.edu.cn/" target="_blank" rel="noopener noreferrer">长师官网</a></li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>
  </header>

  <main id="main-content" tabindex="-1">
    <section class="hero-section" id="home" aria-labelledby="page-title">
      <div class="hero-pattern pattern-left" aria-hidden="true"></div>
      <div class="hero-pattern pattern-right" aria-hidden="true"></div>
      <div class="hero-content">
        <p class="eyebrow"><span></span> CLASS OF ${GRADUATION_YEAR} · ${englishYears} <span></span></p>
        <p class="hero-school">长江师范学院</p>
        <h1 id="page-title">${GRADUATION_YEAR}届优秀毕业生<br />${anniversaryLabel}纪念</h1>
        <p class="hero-subtitle">${yearRange} · 以青春作序，致敬一路闪耀的你们</p>
        <div class="hero-rule" aria-hidden="true"><i></i></div>
        <p class="hero-note">愿你们奔赴辽阔天地，始终葆有少年般澄澈的眼睛与热望。</p>
      </div>
      <a class="scroll-cue" href="#honor-roll">
        <span>向下阅览</span>
        <i aria-hidden="true"></i>
      </a>
    </section>

    <section class="intro-section" aria-label="毕业纪念引言">
      <div class="section-label">A MOMENT TO REMEMBER</div>
      <p>${yearsLabel}，从课堂的晨光到江畔的晚风，从毕业出发到今日回望，<br class="desktop-break" />你们以勤勉、热爱与担当，为青春与人生写下了熠熠生辉的注脚。</p>
      <span class="intro-signature">- ${yearRange} · 毕业${anniversaryLabel}纪念 -</span>
    </section>

    <section class="honor-section" id="honor-roll" aria-labelledby="honor-title">
      <div class="section-heading">
        <div>
          <p class="heading-kicker">HONOR ROLL</p>
          <h2 id="honor-title">优秀毕业生名录</h2>
        </div>
      </div>
      <div class="graduate-grid${graduateGridClass}"${graduateGridStyle}>
        ${graduateCards}
      </div>
    </section>

    <section class="memory-section" id="memory" aria-labelledby="memory-title">
      <div class="memory-copy">
        <p class="heading-kicker">THE DAYS WE SHARED</p>
        <h2 id="memory-title">${yearsLabel}砥砺，荣光不改</h2>
        <p>${yearsLabel}，不只是时间的刻度。它是走出校园后的坚持与开拓，是将所学融入事业的担当，也是成长路上始终明亮的初心。</p>
      </div>
      <ol class="memory-list">
        <li>
          <span>${GRADUATION_YEAR}</span>
          <strong>启程</strong>
          <p>带着师长嘱托与青春热望，踏上人生新征程。</p>
        </li>
        <li>
          <span>${yearsLabel}</span>
          <strong>成长</strong>
          <p>在各自的岗位上，成为更坚定、更丰盈的自己。</p>
        </li>
        <li>
          <span>不变</span>
          <strong>初心</strong>
          <p>用每一份坚持，回应青春许下的期待。</p>
        </li>
        <li>
          <span>${currentYear}</span>
          <strong>致敬</strong>
          <p>以毕业${anniversaryLabel}为记，致敬一路成长与闪耀。</p>
        </li>
      </ol>
    </section>

    <section class="tribute-section" id="tribute" aria-labelledby="tribute-title">
      <div class="tribute-frame">
        <p class="heading-kicker">IN HONOR OF EXCELLENCE</p>
        <h2 id="tribute-title">${yearsLabel}砥砺初心<br />致敬优秀的你们</h2>
        <p>愿每一份热爱皆有回响，愿每一程奋斗都绽放光芒。</p>
        <span class="tribute-year">${yearRange}</span>
      </div>
    </section>
  </main>

  <dialog class="letter-dialog" id="graduate-letter-dialog" aria-labelledby="letter-dialog-title">
    <button class="letter-dialog-close" type="button" aria-label="关闭信件对话框">×</button>
    <div class="letter-dialog-shell">
      <section class="letter-gate">
        <p class="letter-kicker">A LETTER FOR YOU</p>
        <h2 id="letter-dialog-title">致<span data-letter-student>同学</span>的一封信</h2>
        <p class="letter-hint">输入你的学号，开启这封为你珍藏的信。</p>
        <div class="envelope-stage" aria-hidden="true">
          <div class="envelope">
            <div class="envelope-back"></div>
            <div class="envelope-sheet"></div>
            <div class="envelope-front"></div>
            <div class="envelope-flap"></div>
            <div class="envelope-seal">长师</div>
          </div>
        </div>
        <form class="letter-unlock-form">
          <label for="student-number">学号</label>
          <div class="letter-input-row">
            <input id="student-number" name="studentNumber" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="64" />
            <button type="submit">开启信封</button>
          </div>
          <p class="letter-error" role="alert" aria-live="polite"></p>
        </form>
      </section>
      <article class="letter-paper" aria-hidden="true" hidden>
        <p class="letter-paper-date">${currentYear}</p>
        <h2 tabindex="-1">致<span data-letter-student>同学</span>的一封信</h2>
        <p>亲爱的<span data-letter-student>同学</span>：</p>
        <div class="letter-body" data-letter-body></div>
        <footer>
          <strong data-letter-signoff>长江师范学院</strong>
          <span>${currentYear}年</span>
        </footer>
      </article>
    </div>
  </dialog>

  <footer class="site-footer">
    <p><strong>长江师范学院</strong> · 重庆市涪陵区聚贤大道16号</p>
    <p>CLASS OF ${GRADUATION_YEAR} · EXCELLENCE MEMORIAL · ${currentYear}</p>
  </footer>
`

  const navigationLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('.anniversary-nav a[href^="#"]'),
  )

  const setCurrentNavigation = (targetId: string) => {
    navigationLinks.forEach((link) => {
      const isCurrent = link.getAttribute('href') === `#${targetId}`
      link.closest('li')?.classList.toggle('is-current', isCurrent)

      if (isCurrent) {
        link.setAttribute('aria-current', 'location')
      } else {
        link.removeAttribute('aria-current')
      }
    })
  }

  const observedSections = navigationLinks
    .map((link) => document.querySelector<HTMLElement>(link.getAttribute('href') ?? ''))
    .filter((section): section is HTMLElement => section !== null)

  activeNavigationObserver = new IntersectionObserver(
    (entries) => {
      const activeEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0]

      if (activeEntry) {
        setCurrentNavigation(activeEntry.target.id)
      }
    },
    { rootMargin: '-18% 0px -64%', threshold: [0.1, 0.35, 0.6] },
  )

  observedSections.forEach((section) => activeNavigationObserver?.observe(section))
}

const localYear = Math.max(GRADUATION_YEAR, getChinaYear(new Date()))
renderPage(localYear)
setupVisitorTracking()
setupGraduateLetters()

void getCurrentYear().then((networkYear) => {
  const normalizedYear = Math.max(GRADUATION_YEAR, networkYear)

  if (normalizedYear !== Number(document.documentElement.dataset.currentYear)) {
    renderPage(normalizedYear)
  }
})
