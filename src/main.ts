import './style.css'

type Graduate = {
  number: string
  name: string
  department: string
  honor: string
  message: string
}

const assetUrl = (filename: string) => `${import.meta.env.BASE_URL}${filename}`

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

// 真实优秀毕业生资料确认后，可在此替换展示占位内容。
const graduates: Graduate[] = [
  {
    number: '01',
    name: '优秀学生',
    department: '长江师范学院 · 2017届',
    honor: '优秀毕业生',
    message: '将课堂上的求知与热爱，带往更广阔的山海。',
  },
  {
    number: '02',
    name: '优秀学生',
    department: '长江师范学院 · 2017届',
    honor: '励志成长之星',
    message: '以笃行回应青春，以责任照亮前路。',
  },
  {
    number: '03',
    name: '优秀学生',
    department: '长江师范学院 · 2017届',
    honor: '学业卓越之星',
    message: '以好学之心守住初心，以实干之姿奔赴未来。',
  },
  {
    number: '04',
    name: '优秀学生',
    department: '长江师范学院 · 2017届',
    honor: '实践服务之星',
    message: '让青春的脚步，始终与时代的脉搏同频。',
  },
  {
    number: '05',
    name: '优秀学生',
    department: '长江师范学院 · 2017届',
    honor: '创新创业之星',
    message: '怀揣敢为人先的勇气，书写自己的答案。',
  },
  {
    number: '06',
    name: '优秀学生',
    department: '长江师范学院 · 2017届',
    honor: '全面发展之星',
    message: '此去星辰大海，仍心系母校与同窗。',
  },
]

const graduateCards = graduates
  .map(
    ({ number, name, department, honor, message }) => `
      <article class="graduate-card">
        <div class="card-topline">
          <span class="graduate-number">${escapeHtml(number)}</span>
          <span class="card-mark" aria-hidden="true"></span>
        </div>
        <div class="portrait" aria-label="毕业年份纪念徽章">
          <span>2017</span>
        </div>
        <p class="card-honor">${escapeHtml(honor)}</p>
        <h3>${escapeHtml(name)}</h3>
        <p class="card-department">${escapeHtml(department)}</p>
        <p class="card-message">${escapeHtml(message)}</p>
      </article>`,
  )
  .join('')

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
                <li class="links i3"><a href="#memory">十年回望</a></li>
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
        <p class="eyebrow"><span></span> CLASS OF 2017 · TEN YEARS ON <span></span></p>
        <p class="hero-school">长江师范学院</p>
        <h1 id="page-title">2017届优秀毕业生<br />十周年纪念</h1>
        <p class="hero-subtitle">2017 — 2027 · 以青春作序，致敬一路闪耀的你们</p>
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
      <p>十年，从课堂的晨光到江畔的晚风，从毕业出发到今日回望，<br class="desktop-break" />你们以勤勉、热爱与担当，为青春与人生写下了熠熠生辉的注脚。</p>
      <span class="intro-signature">- 2017 — 2027 · 毕业十周年纪念 -</span>
    </section>

    <section class="honor-section" id="honor-roll" aria-labelledby="honor-title">
      <div class="section-heading">
        <div>
          <p class="heading-kicker">HONOR ROLL</p>
          <h2 id="honor-title">优秀毕业生名录</h2>
        </div>
      </div>
      <div class="graduate-grid">
        ${graduateCards}
      </div>
    </section>

    <section class="memory-section" id="memory" aria-labelledby="memory-title">
      <div class="memory-copy">
        <p class="heading-kicker">THE DAYS WE SHARED</p>
        <h2 id="memory-title">十年砥砺，荣光不改</h2>
        <p>十年，不只是时间的刻度。它是走出校园后的坚持与开拓，是将所学融入事业的担当，也是成长路上始终明亮的初心。</p>
      </div>
      <ol class="memory-list">
        <li>
          <span>2017</span>
          <strong>启程</strong>
          <p>带着师长嘱托与青春热望，踏上人生新征程。</p>
        </li>
        <li>
          <span>十年</span>
          <strong>成长</strong>
          <p>在各自的岗位上，成为更坚定、更丰盈的自己。</p>
        </li>
        <li>
          <span>不变</span>
          <strong>初心</strong>
          <p>用每一份坚持，回应青春许下的期待。</p>
        </li>
        <li>
          <span>2027</span>
          <strong>致敬</strong>
          <p>以毕业十周年为记，致敬一路成长与闪耀。</p>
        </li>
      </ol>
    </section>

    <section class="tribute-section" id="tribute" aria-labelledby="tribute-title">
      <div class="tribute-frame">
        <p class="heading-kicker">IN HONOR OF EXCELLENCE</p>
        <h2 id="tribute-title">十年砥砺初心<br />致敬优秀的你们</h2>
        <p>愿每一份热爱皆有回响，愿每一程奋斗都绽放光芒。</p>
        <span class="tribute-year">2017—2027</span>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <p><strong>长江师范学院</strong> · 重庆市涪陵区聚贤大道16号</p>
    <p>CLASS OF 2017 · EXCELLENCE MEMORIAL · 2027</p>
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

const navigationObserver = new IntersectionObserver(
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

observedSections.forEach((section) => navigationObserver.observe(section))
