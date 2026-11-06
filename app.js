/* CodeShell 官网：版本拉取 + 动效编排 */

/* ============================================================
   一、从公开 Release 拉最新版本号与产物链接（失败静默回退）
   ============================================================ */
const REPO = 'ycui980429-hue/CodeShell'

async function loadRelease() {
  let rel = null
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (r.ok) rel = await r.json()
  } catch (e) { /* 离线 / 限流：保持静态回退链接 */ }
  if (!rel || !rel.assets) return

  const ver = (rel.tag_name || '').replace(/^v/, '')
  if (ver) {
    const v1 = document.getElementById('latest-version')
    const v2 = document.getElementById('dl-version')
    if (v1) v1.textContent = 'v' + ver
    if (v2) v2.textContent = 'v' + ver
  }

  const byName = (re) => rel.assets.find(a => re.test(a.name))
  const mac = byName(/arm64\.dmg$/)
  const win = byName(/win-x64-setup\.exe$/)
  const dl = (a) => (a ? a.browser_download_url : `https://github.com/${REPO}/releases/latest`)
  const size = (a) => (a ? ` · ${(a.size / 1048576).toFixed(0)} MB` : '')

  const m = document.getElementById('dl-mac')
  const w = document.getElementById('dl-win')
  if (m) { m.href = dl(mac); const s = document.getElementById('dl-mac-size'); if (s) s.textContent = size(mac) }
  if (w) { w.href = dl(win); const s = document.getElementById('dl-win-size'); if (s) s.textContent = size(win) }
  const cm = document.getElementById('dl-card-mac')
  const cw = document.getElementById('dl-card-win')
  if (cm) cm.href = dl(mac)
  if (cw) cw.href = dl(win)
}

/* ============================================================
   二、动效
   ------------------------------------------------------------
   主镜头是终端演示：命令逐字敲入 → 输出逐行浮现 → AI 回应滑入。
   只演一次，不循环（循环的分神成本高于它带来的生动）。
   reduced-motion 下直接跳到终态，不做敲字与位移。
   ============================================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---- 主镜头：终端演示 ---- */
const DEMO_LINES = [
  { html: '<span class="g">● nginx.service - A high performance web server</span>', delay: 260 },
  { html: '   <span class="dim">Loaded:</span> loaded (/lib/systemd/system/nginx.service; enabled)', delay: 150 },
  { html: '   <span class="dim">Active:</span> <span class="g">active (running)</span> since Tue 06:11; 43 days ago', delay: 150 },
  { html: '<span class="p">root@web-01:~#</span> ', delay: 260 },
]

function runTerminalDemo() {
  const typed = document.getElementById('typed')
  const cursor = document.getElementById('cursor')
  const linesBox = document.getElementById('demo-lines')
  const ai = document.getElementById('shot-ai')
  if (!typed || !cursor || !linesBox) return

  const FULL = typed.textContent
  const demo = document.getElementById('demo-term')

  // reduced-motion：直接终态
  if (reduceMotion) {
    cursor.classList.add('idle')
    linesBox.innerHTML = DEMO_LINES.map(l => `<span>${l.html}</span>`).join('')
    for (const el of linesBox.children) el.classList.add('show')
    if (ai) ai.classList.add('show')
    return
  }

  // 逐字敲入（每字 38ms，带一点随机抖动模拟真人节奏）
  typed.textContent = ''
  cursor.classList.add('idle')
  let i = 0
  const typeNext = () => {
    if (i >= FULL.length) {
      // 敲完：光标移到命令行末，回车后输出逐行浮现
      cursor.classList.remove('idle')
      linesBox.innerHTML = ''
      let k = 0
      const showLine = () => {
        if (k >= DEMO_LINES.length) {
          // 输出完毕：AI 回应滑入
          if (ai) ai.classList.add('show')
          return
        }
        const span = document.createElement('span')
        span.className = 'line'
        span.innerHTML = DEMO_LINES[k].html
        linesBox.appendChild(span)
        // 强制一次回流再上类，保证过渡生效
        void span.offsetWidth
        span.classList.add('show')
        const d = DEMO_LINES[k].delay
        k++
        setTimeout(showLine, d)
      }
      setTimeout(showLine, 420)
      return
    }
    typed.textContent = FULL.slice(0, ++i)
    setTimeout(typeNext, 34 + Math.random() * 46)
  }

  // 进入视口再开始演：用户还没滚动到就别在后台空跑
  if (demo && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) { io.disconnect(); setTimeout(typeNext, 420); return }
      }
    }, { threshold: 0.25 })
    io.observe(demo)
  } else {
    setTimeout(typeNext, 420)
  }
}

/* ---- 滚动揭示 ---- */
function initReveal() {
  // 给同级卡片编上 stagger 序号（总延迟封顶 180ms，即最多 4 张参与错峰）
  document.querySelectorAll('.grid, .sec-grid, .plug-grid, .dl-grid').forEach(group => {
    group.classList.add('reveal-group')
    Array.from(group.children).forEach((child, i) => {
      child.classList.add('reveal-child')
      child.style.setProperty('--i', Math.min(i, 4))
    })
  })
  const targets = document.querySelectorAll('.section-inner > h2, .section-inner > .section-sub, .reveal-group, .plug-note, .dl-note')
  if (!('IntersectionObserver' in window) || reduceMotion) {
    targets.forEach(t => t.classList.add('in'))
    return
  }
  targets.forEach(t => { if (!t.classList.contains('reveal-group')) t.classList.add('reveal') })
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue
      en.target.classList.add('in')
      io.unobserve(en.target)
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' })
  targets.forEach(t => io.observe(t))
}

loadRelease()
initReveal()
runTerminalDemo()
