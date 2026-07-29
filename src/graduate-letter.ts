const visitorApiUrl = import.meta.env.VITE_VISITOR_API_URL?.trim()

const getLetterApiUrl = () => {
  if (!visitorApiUrl) return null

  try {
    const url = new URL(visitorApiUrl)
    if (!/\/api\/visit\/?$/.test(url.pathname)) return null
    url.pathname = url.pathname.replace(/\/api\/visit\/?$/, '/api/letter/unlock')
    return url.toString()
  } catch {
    return null
  }
}

const getDeviceType = () => {
  if (window.matchMedia('(max-width: 560px)').matches) return '移动端'
  if (window.matchMedia('(max-width: 840px)').matches) return '平板'
  return '桌面端'
}

const letterApiUrl = getLetterApiUrl()
let initialized = false

export const setupGraduateLetters = () => {
  if (initialized) return
  initialized = true

  let activeTrigger: HTMLButtonElement | null = null

  const getDialog = () => document.querySelector<HTMLDialogElement>('#graduate-letter-dialog')

  const resetDialog = (dialog: HTMLDialogElement) => {
    dialog.classList.remove('is-unlocked', 'is-submitting')
    dialog.removeAttribute('data-letter-key')
    dialog.querySelector<HTMLFormElement>('.letter-unlock-form')?.reset()

    const error = dialog.querySelector<HTMLElement>('.letter-error')
    const paper = dialog.querySelector<HTMLElement>('.letter-paper')
    const body = dialog.querySelector<HTMLElement>('[data-letter-body]')

    if (error) error.textContent = ''
    if (body) body.textContent = ''
    if (paper) {
      paper.hidden = true
      paper.setAttribute('aria-hidden', 'true')
    }
  }

  const openDialog = (trigger: HTMLButtonElement) => {
    const dialog = getDialog()
    if (!dialog) return

    resetDialog(dialog)
    activeTrigger = trigger
    dialog.dataset.letterKey = trigger.dataset.letterKey ?? ''

    const name = trigger.dataset.studentName ?? '同学'
    dialog.querySelectorAll<HTMLElement>('[data-letter-student]').forEach((element) => {
      element.textContent = name
    })

    dialog.showModal()
    window.setTimeout(() => dialog.querySelector<HTMLInputElement>('#student-number')?.focus(), 0)
  }

  const closeDialog = (dialog: HTMLDialogElement) => {
    dialog.close()
    resetDialog(dialog)
    activeTrigger?.focus()
    activeTrigger = null
  }

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return

    const trigger = target.closest<HTMLButtonElement>('.graduate-letter-trigger')
    if (trigger) {
      openDialog(trigger)
      return
    }

    const dialog = getDialog()
    if (!dialog) return

    if (target.closest('.letter-dialog-close')) {
      closeDialog(dialog)
      return
    }

    if (target === dialog) closeDialog(dialog)
  })

  document.addEventListener('submit', async (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || !form.matches('.letter-unlock-form')) return

    event.preventDefault()
    const dialog = getDialog()
    const input = form.querySelector<HTMLInputElement>('#student-number')
    const error = dialog?.querySelector<HTMLElement>('.letter-error')
    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    const letterKey = dialog?.dataset.letterKey ?? ''
    const studentNumber = input?.value.trim() ?? ''

    if (!dialog || !input || !error || !submitButton) return
    if (!studentNumber) {
      error.textContent = '请输入学号。'
      input.focus()
      return
    }

    if (!letterApiUrl) {
      error.textContent = '信件服务暂未开放。'
      return
    }

    error.textContent = ''
    dialog.classList.add('is-submitting')
    submitButton.disabled = true

    try {
      const response = await fetch(letterApiUrl, {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          letterKey,
          studentNumber,
          page: window.location.pathname,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          device: getDeviceType(),
        }),
      })

      if (!response.ok) {
        error.textContent =
          response.status === 429
            ? '尝试次数过多，请稍后再试。'
            : response.status >= 500
              ? '信件服务暂时不可用，请稍后再试。'
              : '学号不正确，请重新输入。'
        input.select()
        return
      }

      const result = (await response.json()) as { studentName?: string; letter?: string }
      if (!result.letter) throw new Error('Missing letter content')

      const paper = dialog.querySelector<HTMLElement>('.letter-paper')
      const body = dialog.querySelector<HTMLElement>('[data-letter-body]')
      if (!paper || !body) throw new Error('Missing letter elements')

      dialog.querySelectorAll<HTMLElement>('[data-letter-student]').forEach((element) => {
        element.textContent = result.studentName || activeTrigger?.dataset.studentName || '同学'
      })
      body.textContent = result.letter
      paper.hidden = false
      paper.setAttribute('aria-hidden', 'false')
      void paper.offsetWidth
      dialog.classList.add('is-unlocked')
      window.setTimeout(() => paper.querySelector<HTMLElement>('h2')?.focus(), 1150)
    } catch {
      error.textContent = '信件服务暂时不可用，请稍后再试。'
    } finally {
      dialog.classList.remove('is-submitting')
      submitButton.disabled = false
    }
  })

  document.addEventListener('cancel', (event) => {
    const dialog = event.target
    if (!(dialog instanceof HTMLDialogElement) || dialog.id !== 'graduate-letter-dialog') return
    event.preventDefault()
    closeDialog(dialog)
  }, true)
}
