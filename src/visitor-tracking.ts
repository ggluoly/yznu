const visitorApiUrl = import.meta.env.VITE_VISITOR_API_URL?.trim()

const getDeviceType = () => {
  if (window.matchMedia('(max-width: 560px)').matches) return '移动端'
  if (window.matchMedia('(max-width: 840px)').matches) return '平板'
  return '桌面端'
}

const sendVisit = (eventType: '页面加载' | '历史恢复') => {
  if (!visitorApiUrl) return

  void fetch(visitorApiUrl, {
    method: 'POST',
    credentials: 'omit',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      page: window.location.pathname,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      device: getDeviceType(),
      eventType,
    }),
  }).catch(() => {
    // Visitor logging must never affect the memorial page.
  })
}

export const setupVisitorTracking = () => {
  let initialVisitRecorded = false

  const recordInitialVisit = () => {
    if (initialVisitRecorded) return
    initialVisitRecorded = true
    sendVisit('页面加载')
  }

  if (document.readyState === 'complete') {
    recordInitialVisit()
  } else {
    window.addEventListener('load', recordInitialVisit, { once: true })
  }

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) sendVisit('历史恢复')
  })
}
