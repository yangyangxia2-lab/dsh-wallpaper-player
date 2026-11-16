# dsh-wallpaper-player

A [DeepSeek Harness](https://github.com/deepseek-ai) bundle plugin that lists your local
Wallpaper Engine wallpapers and plays the video ones inside a DSH settings page. Scene and
web wallpapers show their preview image.

在 DeepSeek Harness 里直接浏览、播放本地 Wallpaper Engine 壁纸：视频壁纸用浏览器原生 `<video>` 播放（支持 HTTP Range 拖动进度），场景 / 网页壁纸显示静态预览。

## Features

- Auto-discovers Wallpaper Engine (Steam app 431960): projects shipped with the install plus
  every subscribed Workshop item
- New **Wallpaper player** section in DSH Settings: a 16:9 player with a playlist
- Custom controls: play/pause, previous/next, seek, volume, mute, speed, loop, shuffle, fullscreen
- Search and type filters (all / video / scene / web / image)
- Remembers the last wallpaper, volume, loop and speed (localStorage)
- Keyboard: `Space` play/pause, `←`/`→` seek 5 s, `↑`/`↓` volume, `M` mute, `F` fullscreen,
  `N`/`P` next/previous
- Follows the DSH dark theme (`--dsw-alias-*` tokens); plain React page, no iframe

## 功能

- 自动发现 Wallpaper Engine（Steam 431960）：安装目录自带项目 + 所有已订阅的创意工坊内容
- 设置页新增「壁纸播放器」：16:9 播放器 + 播放列表
- 自定义控制条：播放/暂停、上一张/下一张、进度拖动、音量、静音、倍速、循环、随机、全屏
- 搜索 + 类型筛选（全部 / 视频 / 场景 / 网页 / 图片）
- 记住上次播放的壁纸、音量、循环与倍速（localStorage）
- 键盘快捷键：空格播放/暂停，←/→ 快退/快进 5 秒，↑/↓ 音量，`M` 静音，`F` 全屏，`N`/`P` 下一张/上一张
- 主题跟随 DSH 深色界面（`--dsw-alias-*` token），纯 React 页面，不使用 iframe

## 安装

在 DSH 中通过插件市场安装，或使用 plugin manager：

```
plugin_manager install_bundle -> <this package directory>
```

安装后打开「设置 → 壁纸播放器」。若刚替换过包，需要重启 DSH 才会生效。

## 配置（可选）

插件 host 端支持以下 config 覆盖，用于非标准安装位置：

```yaml
- id: wallpaper-player
  name: dsh-wallpaper-player
  config:
    installDir: 'D:\Steam\steamapps\common\wallpaper_engine'
    libraryDirs: ['D:\OtherLibrary\steamapps\workshop\content\431960']
```

也支持环境变量 `DSH_WALLPAPER_ENGINE_DIR` / `WALLPAPER_ENGINE_DIR` / `STEAM_PATH`。

## HTTP 接口

同源，全部只读：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/wallpaper-player/library` | 壁纸列表 JSON；`?refresh=1` 强制重扫，`?q=` / `?kind=` 过滤 |
| GET / HEAD | `/wallpaper-player/preview/:id` | 项目预览图（ETag / 304） |
| GET / HEAD | `/wallpaper-player/media/:id` | 视频或图片流，支持 `Range`（206 / 416） |

`id` 是扫描时生成的摘要，客户端无法用它请求任意文件路径。

## 限制

- 场景（scene）与网页（web）壁纸需要 Wallpaper Engine 的实时渲染，本插件只显示预览图。
- 视频能否播放取决于浏览器支持的编码（通常 H.264 MP4 没问题；VP9/WebM 视内置 Chromium 而定）。

## License

MIT
