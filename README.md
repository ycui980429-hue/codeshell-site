# CodeShell 官网

CodeShell（运维一体化工作台）的官方网站，纯静态、零依赖：`index.html` + `styles.css` + `app.js`。

- 版本号与下载链接从 GitHub Releases（`ycui980429-hue/CodeShell`）动态拉取，拉取失败时回退到 releases 页
- 图标与配色与应用同源（琥珀强调、墨色底）

## 本地预览

```bash
cd codeshell-site
python3 -m http.server 8080
# 打开 http://localhost:8080
```

## 发布

推到 `main` 即由 GitHub Pages 发布（仓库 Settings → Pages → Deploy from branch）。
