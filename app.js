/* CodeShell 官网：从公开 Release 拉最新版本号与产物链接（无依赖，失败静默回退） */
const REPO = 'ycui980429-hue/CodeShell'

async function init() {
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

  const macAsset = mac, winAsset = win
  const m = document.getElementById('dl-mac')
  const w = document.getElementById('dl-win')
  if (m) { m.href = dl(macAsset); const s = document.getElementById('dl-mac-size'); if (s) s.textContent = size(macAsset) }
  if (w) { w.href = dl(winAsset); const s = document.getElementById('dl-win-size'); if (s) s.textContent = size(winAsset) }
  const cm = document.getElementById('dl-card-mac')
  const cw = document.getElementById('dl-card-win')
  if (cm) cm.href = dl(macAsset)
  if (cw) cw.href = dl(winAsset)
}

init()
