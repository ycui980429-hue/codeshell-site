/* ============================================================
   鼠标驱动背景特效
   ------------------------------------------------------------
   1) 粒子网格：每个点有「家」坐标，光标靠近时被推开，离开后弹回。
      邻近粒子之间画细线，光标与近处的粒子连线更亮（跟随鼠标）。
   2) 跟手光斑：一层琥珀色径向渐变，缓动追随光标。
   3) 卡片 3D 倾斜：鼠标在卡片上时按相对位置轻微立体旋转。

   工程约束：
   - 全部 pointer-events: none，不挡任何交互
   - 只在有鼠标的设备 + 允许动画时启动；reduced-motion / 触屏直接不跑
   - 标签页隐藏、滚动出视口时暂停，省电
   - 粒子数按视口面积与 DPR 自适应，最多 130 个
   ============================================================ */

(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  if (reduce.matches || !finePointer.matches) return

  const canvas = document.getElementById('fx-bg')
  const spot = document.getElementById('fx-spotlight')
  if (!canvas || !spot) return

  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return

  const ACCENT = '240, 162, 75'   // 与 --accent 同源（rgb 分量）
  const GREEN = '63, 191, 127'
  const LINK_DIST = 148           // 粒子互连距离
  const MOUSE_DIST = 230          // 光标影响半径
  const PUSH = 46                 // 最大斥力位移

  let W = 0, H = 0, dpr = 1
  let particles = []
  const mouse = { x: -9999, y: -9999, active: false }
  // 光斑的实际位置（缓动跟随，产生「拖尾」感）
  const spotPos = { x: 0, y: 0, init: false }

  let rafId = 0
  let running = true

  const easeOut = (x) => 1 - Math.pow(1 - x, 3)

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = window.innerWidth
    H = window.innerHeight
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    buildParticles()
  }

  function buildParticles() {
    // 密度随面积走，上限 130 —— 粒度过密会糊成噪点、也吃 CPU
    const target = Math.min(190, Math.round((W * H) / 11000))
    particles = []
    const cols = Math.ceil(Math.sqrt(target * (W / H)))
    const rows = Math.max(1, Math.ceil(target / cols))
    const gapX = W / (cols + 1)
    const gapY = H / (rows + 1)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hx = gapX * (c + 1) + (Math.random() - 0.5) * gapX * 0.5
        const hy = gapY * (r + 1) + (Math.random() - 0.5) * gapY * 0.5
        particles.push({
          hx, hy,            // home：静止位置
          x: hx, y: hy,      // 当前位置
          vx: 0, vy: 0,      // 速度（弹簧回位用）
          // 少数点用绿色，呼应终端里的状态色
          hue: Math.random() < 0.12 ? GREEN : ACCENT,
          size: 1.1 + Math.random() * 1.5,
          drift: 0.12 + Math.random() * 0.22,   // 缓慢漂移速度
          phase: Math.random() * Math.PI * 2,
        })
      }
    }
  }

  function step(t) {
    if (!running) return
    rafId = requestAnimationFrame(step)

    ctx.clearRect(0, 0, W, H)

    // ---- 粒子物理：斥力 + 弹簧回位 + 轻微阻尼 ----
    for (const p of particles) {
      // 无鼠标时也缓慢漂移：静止的粒子网格看起来像贴图
      p.hx += Math.cos(t / 4200 + p.phase) * p.drift * 0.16
      p.hy += Math.sin(t / 5100 + p.phase * 1.3) * p.drift * 0.16
      if (mouse.active) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const d2 = dx * dx + dy * dy
        if (d2 < MOUSE_DIST * MOUSE_DIST) {
          const d = Math.sqrt(d2) || 0.001
          const force = (1 - d / MOUSE_DIST) ** 2 * PUSH
          p.vx += (dx / d) * force * 0.16
          p.vy += (dy / d) * force * 0.16
        }
      }
      // 弹簧拉回 home
      p.vx += (p.hx - p.x) * 0.012
      p.vy += (p.hy - p.y) * 0.012
      p.vx *= 0.92
      p.vy *= 0.92
      p.x += p.vx
      p.y += p.vy
    }

    // ---- 粒子互连：距离越近越亮（上限控制，避免 O(n²) 开销过大）----
    ctx.lineWidth = 0.7
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i]
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d2 = dx * dx + dy * dy
        if (d2 > LINK_DIST * LINK_DIST) continue
        const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.26
        ctx.strokeStyle = `rgba(${ACCENT}, ${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }

    // ---- 光标到近处粒子的连线：鼠标移动的主要视觉反馈 ----
    if (mouse.active) {
      for (const p of particles) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const d2 = dx * dx + dy * dy
        if (d2 > MOUSE_DIST * MOUSE_DIST) continue
        const d = Math.sqrt(d2)
        const alpha = (1 - d / MOUSE_DIST) * 0.72
        ctx.strokeStyle = `rgba(${p.hue}, ${alpha.toFixed(3)})`
        ctx.lineWidth = 0.9
        ctx.beginPath()
        ctx.moveTo(mouse.x, mouse.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
      // 光标本体：光核 + 环绕能量圈（脉冲式呼吸，跟随光标）
      const pulse = 1 + 0.12 * Math.sin(t / 380)
      const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 34)
      g.addColorStop(0, `rgba(${ACCENT}, .62)`)
      g.addColorStop(0.45, `rgba(${ACCENT}, .16)`)
      g.addColorStop(1, `rgba(${ACCENT}, 0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(mouse.x, mouse.y, 34, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = `rgba(${ACCENT}, ${(0.22 + 0.12 * Math.sin(t / 380)).toFixed(3)})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(mouse.x, mouse.y, 30 * pulse, 0, Math.PI * 2)
      ctx.stroke()
    }

    // ---- 粒子本体：轻微呼吸（只改透明度，不动位置）----
    for (const p of particles) {
      const tw = 0.55 + 0.35 * Math.sin(t / 900 + p.phase)
      ctx.fillStyle = `rgba(${p.hue}, ${tw.toFixed(3)})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }

    // ---- 点击迸发环：0.75 秒内扩到 260px 并淡出 ----
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]
      const age = (t - b.born) / 750
      if (age >= 1) { bursts.splice(i, 1); continue }
      const r = 12 + easeOut(age) * 250
      const a = (1 - age) ** 2 * 0.55
      ctx.strokeStyle = `rgba(${ACCENT}, ${a.toFixed(3)})`
      ctx.lineWidth = 1.6 * (1 - age) + 0.4
      ctx.beginPath()
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
      ctx.stroke()
    }

    // ---- 光斑缓动跟随（0.12 的系数给出一点拖尾）----
    if (mouse.active) {
      if (!spotPos.init) { spotPos.x = mouse.x; spotPos.y = mouse.y; spotPos.init = true }
      spotPos.x += (mouse.x - spotPos.x) * 0.12
      spotPos.y += (mouse.y - spotPos.y) * 0.12
      spot.style.transform = `translate3d(${spotPos.x}px, ${spotPos.y}px, 0)`
    }
  }

  // ---- 输入 ----
  window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX
    mouse.y = e.clientY
    if (!mouse.active) {
      mouse.active = true
      spot.classList.add('on')
      if (!running) { running = true; rafId = requestAnimationFrame(step) }
    }
  }, { passive: true })

  window.addEventListener('pointerleave', () => {
    mouse.active = false
    spot.classList.remove('on')
  })

  document.addEventListener('mouseleave', () => {
    mouse.active = false
    spot.classList.remove('on')
  })

  // 点击迸发：一圈快速外扩并淡出的光环（+ 附近粒子被弹开）
  const bursts = []
  window.addEventListener('pointerdown', (e) => {
    bursts.push({ x: e.clientX, y: e.clientY, born: performance.now() })
    for (const p of particles) {
      const dx = p.x - e.clientX, dy = p.y - e.clientY
      const d = Math.hypot(dx, dy)
      if (d < 280 && d > 0.001) {
        const f = (1 - d / 280) ** 2 * 90
        p.vx += (dx / d) * f * 0.28
        p.vy += (dy / d) * f * 0.28
      }
    }
  }, { passive: true })

  // 标签页隐藏时停帧：后台不必烧 CPU
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; cancelAnimationFrame(rafId) }
    else if (!running) { running = true; rafId = requestAnimationFrame(step) }
  })

  let resizeTimer = 0
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(size, 140)
  })

  /* ============================================================
     卡片 3D 倾斜
     ------------------------------------------------------------
     鼠标在卡片上时按相对位置旋转 ±5°，离开回正。
     只对指针设备启用；不改变布局（纯 transform）。
     ============================================================ */
  function initTilt() {
    const els = document.querySelectorAll('.card, .hero-shot, .dl-card, .plug-item, .sec-item')
    els.forEach((el) => {
      el.classList.add('tilt')
      let raf = 0
      let targetRX = 0, targetRY = 0
      let curRX = 0, curRY = 0

      const animate = () => {
        curRX += (targetRX - curRX) * 0.18
        curRY += (targetRY - curRY) * 0.18
        el.style.transform = `perspective(900px) rotateX(${curRX.toFixed(2)}deg) rotateY(${curRY.toFixed(2)}deg)`
        if (Math.abs(targetRX - curRX) > 0.02 || Math.abs(targetRY - curRY) > 0.02) {
          raf = requestAnimationFrame(animate)
        } else {
          el.style.transform = targetRX === 0 && targetRY === 0
            ? ''
            : `perspective(900px) rotateX(${targetRX}deg) rotateY(${targetRY}deg)`
          raf = 0
        }
      }
      const kick = () => { if (!raf) raf = requestAnimationFrame(animate) }

      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        targetRY = px * 10       // 左右倾 ±5°
        targetRX = -py * 10      // 上下倾 ±5°
        el.classList.remove('leaving')
        kick()
      }, { passive: true })

      el.addEventListener('pointerleave', () => {
        targetRX = 0
        targetRY = 0
        el.classList.add('leaving')
        kick()
      })
    })
  }

  size()
  initTilt()
  rafId = requestAnimationFrame(step)
})()
