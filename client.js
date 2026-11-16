/**
 * dsh-wallpaper-player — client half.
 *
 * Renders Settings → 壁纸播放器: a 16:9 player for local Wallpaper Engine video
 * wallpapers (plus previews for scene/web items) with a searchable playlist.
 * The host half serves /wallpaper-player/* on the same origin.
 */

window.__ModuleLoader__.load({
  id: 'dsh-wallpaper-player',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'wallpaper-player'
    const LIBRARY_URL = '/wallpaper-player/library'
    const PREFS_KEY = 'dsh.wallpaper-player.prefs'
    const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

    const DICTS = {
      zh: {
        'nav.label': '壁纸播放器',
        'title.text': '壁纸播放器',
        'subtitle.info': '{total} 个壁纸 · 视频 {videos} · 场景 {scenes}',
        'subtitle.none': '未检测到 Wallpaper Engine 安装。安装并订阅创意工坊壁纸后点击刷新。',
        'action.refresh': '刷新',
        'action.refreshTitle': '重新扫描壁纸库',
        'search.placeholder': '搜索壁纸标题…',
        'filter.all': '全部',
        'filter.video': '视频',
        'filter.scene': '场景',
        'filter.web': '网页',
        'filter.image': '图片',
        'kind.video': '视频',
        'kind.scene': '场景',
        'kind.web': '网页',
        'kind.image': '图片',
        'state.loading': '正在扫描壁纸…',
        'state.emptyTitle': '没有找到壁纸',
        'state.emptyHint': '安装 Wallpaper Engine 并订阅创意工坊壁纸后，点击“刷新”。',
        'state.errorTitle': '无法读取壁纸库',
        'state.errorHint': '请确认 Wallpaper Engine 已安装，且 DSH 有权限读取其目录。',
        'state.noPreview': '暂无预览',
        'player.sceneNote': '场景壁纸需要 Wallpaper Engine 实时渲染，此处显示静态预览。',
        'player.webNote': '网页壁纸需要实时渲染，此处显示静态预览。',
        'player.unsupported': '无法播放该视频（编码可能不受支持）。',
        'player.play': '播放',
        'player.pause': '暂停',
        'player.prev': '上一个',
        'player.next': '下一个',
        'player.mute': '静音',
        'player.unmute': '取消静音',
        'player.fullscreen': '全屏',
        'player.loop': '循环播放',
        'player.shuffle': '随机播放',
        'player.speed': '播放速度',
        'player.volume': '音量',
        'player.time': '播放时间',
        'player.progress': '播放进度',
        'count.text': '{n} 个',
        'badge.playable': '可播放',
        'badge.preview': '仅预览',
      },
      en: {
        'nav.label': 'Wallpaper player',
        'title.text': 'Wallpaper player',
        'subtitle.info': '{total} wallpapers · {videos} videos · {scenes} scenes',
        'subtitle.none': 'No Wallpaper Engine installation found. Install it and subscribe to Workshop wallpapers, then refresh.',
        'action.refresh': 'Refresh',
        'action.refreshTitle': 'Rescan the wallpaper library',
        'search.placeholder': 'Search wallpapers…',
        'filter.all': 'All',
        'filter.video': 'Video',
        'filter.scene': 'Scene',
        'filter.web': 'Web',
        'filter.image': 'Image',
        'kind.video': 'Video',
        'kind.scene': 'Scene',
        'kind.web': 'Web',
        'kind.image': 'Image',
        'state.loading': 'Scanning wallpapers…',
        'state.emptyTitle': 'No wallpapers found',
        'state.emptyHint': 'Install Wallpaper Engine and subscribe to Workshop wallpapers, then click “Refresh”.',
        'state.errorTitle': 'Could not read the wallpaper library',
        'state.errorHint': 'Check that Wallpaper Engine is installed and DSH can read its folders.',
        'state.noPreview': 'No preview',
        'player.sceneNote': 'Scene wallpapers need Wallpaper Engine to render live; this is a static preview.',
        'player.webNote': 'Web wallpapers need live rendering; this is a static preview.',
        'player.unsupported': 'This video cannot be played (unsupported codec).',
        'player.play': 'Play',
        'player.pause': 'Pause',
        'player.prev': 'Previous',
        'player.next': 'Next',
        'player.mute': 'Mute',
        'player.unmute': 'Unmute',
        'player.fullscreen': 'Fullscreen',
        'player.loop': 'Loop',
        'player.shuffle': 'Shuffle',
        'player.speed': 'Speed',
        'player.volume': 'Volume',
        'player.time': 'Playback time',
        'player.progress': 'Playback progress',
        'count.text': '{n} items',
        'badge.playable': 'Playable',
        'badge.preview': 'Preview only',
      },
    }

    function detectLang() {
      if (typeof document === 'undefined') return 'zh'
      const lang = (document.documentElement && document.documentElement.lang) || (typeof navigator !== 'undefined' ? navigator.language : '') || 'zh'
      return String(lang).toLowerCase().startsWith('zh') ? 'zh' : 'en'
    }

    function buildFallback() {
      const dict = DICTS[detectLang()]
      return (key, params) => {
        let text = dict[key] ?? DICTS.en[key] ?? key
        if (params && typeof text === 'string') {
          for (const name of Object.keys(params)) text = text.split(`{${name}}`).join(String(params[name]))
        }
        return text
      }
    }

    let translate = buildFallback()

    function t(key, params) {
      let text
      try {
        text = translate(key, params)
      } catch {
        text = buildFallback()(key, params)
      }
      if (typeof text !== 'string') text = key
      if (params) {
        for (const name of Object.keys(params)) text = text.split(`{${name}}`).join(String(params[name]))
      }
      return text
    }

    function formatTime(value) {
      if (!Number.isFinite(value) || value < 0) return '0:00'
      const total = Math.floor(value)
      const seconds = total % 60
      const minutes = Math.floor(total / 60) % 60
      const hours = Math.floor(total / 3600)
      const pad = (number) => String(number).padStart(2, '0')
      return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
    }

    function kindKey(kind) {
      return `kind.${kind}`
    }

    function readPrefs() {
      try {
        const raw = window.localStorage.getItem(PREFS_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : null
      } catch {
        return null
      }
    }

    function writePrefs(patch) {
      try {
        const merged = { ...(readPrefs() ?? {}), ...patch }
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged))
      } catch {
        // Storage may be unavailable; preferences are best-effort.
      }
    }

    function Icon({ d, size = 14, extra }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true', focusable: 'false' },
        h('path', { d }),
        extra ?? null,
      )
    }

    const ICONS = {
      play: 'M8 5v14l11-7z',
      pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
      prev: 'M7 6h2v12H7zM20 6v12l-9-6z',
      next: 'M15 6h2v12h-2zM4 6l9 6-9 6z',
      volume: 'M4 9v6h4l5 4V5L8 9H4z',
      fullscreen: 'M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z',
      loop: 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
      shuffle: 'M10.6 9.2L5.4 4 4 5.4l5.2 5.2 1.4-1.4zM14.5 4l2 2L4 18.6 5.4 20 17.9 7.5l2 2V4h-5.4zM14.8 13.4l-1.4 1.4 3.1 3.1L14.5 20H20v-5.5l-2 2-3.2-3.1z',
    }

    function Button({ onClick, title, children, active, className }) {
      return h(
        'button',
        {
          type: 'button',
          className: `dwp-btn${active ? ' is-on' : ''}${className ? ` ${className}` : ''}`,
          onClick,
          title,
          'aria-label': title,
        },
        children,
      )
    }

    function Player({ item, playing, onToggle, videoRef, wrapRef, time, duration, onSeek, onLoaded, onTime, onPlay, onPause, onError, error, volume, muted, loop, speed, onVolume, onToggleMute, onToggleLoop, onSetSpeed, onToggleShuffle, shuffle, onPrev, onNext, onFullscreen }) {
      const video = item && item.kind === 'video' && item.playable
      const visual = item && (item.kind === 'scene' || item.kind === 'web' || (item.kind === 'image' && item.playable))

      return h(
        'div',
        { className: 'dwp-player', ref: wrapRef },
        video
          ? h('video', {
              ref: videoRef,
              key: item.id,
              className: 'dwp-video',
              src: item.mediaUrl,
              poster: item.previewUrl ?? undefined,
              preload: 'metadata',
              playsInline: true,
              loop,
              muted,
              onClick: onToggle,
              onDoubleClick: onFullscreen,
              onLoadedMetadata: onLoaded,
              onTimeUpdate: onTime,
              onPlay,
              onPause,
              onError,
              'aria-label': item.title,
            })
          : visual
            ? h(
                'div',
                { className: 'dwp-scene' },
                item.previewUrl
                  ? h('img', { className: 'dwp-poster', src: item.previewUrl, alt: item.title })
                  : h('div', { className: 'dwp-loading' }, t('state.noPreview')),
                h(
                  'div',
                  { className: 'dwp-scene-overlay' },
                  h('span', { className: 'dwp-note' }, t(item.kind === 'web' ? 'player.webNote' : 'player.sceneNote')),
                ),
              )
            : h('div', { className: 'dwp-loading' }, '—'),

        video && !playing && !error
          ? h(
              'button',
              { type: 'button', className: 'dwp-center-play', onClick: onToggle, title: t('player.play'), 'aria-label': t('player.play') },
              h(Icon, { d: ICONS.play, size: 34 }),
            )
          : null,

        error ? h('div', { className: 'dwp-error-box' }, h('span', { className: 'dwp-error' }, t('player.unsupported'))) : null,

        h(
          'div',
          { className: 'dwp-controls' },
          h('input', {
            className: 'dwp-progress',
            type: 'range',
            min: 0,
            max: duration > 0 ? duration : 0,
            step: 0.1,
            value: Math.min(time, duration > 0 ? duration : 0),
            onChange: (event) => onSeek(Number(event.target.value)),
            disabled: !video,
            'aria-label': t('player.progress'),
          }),
          h(
            'div',
            { className: 'dwp-row' },
            h(Button, { onClick: onPrev, title: t('player.prev') }, h(Icon, { d: ICONS.prev })),
            h(Button, { onClick: onToggle, title: playing ? t('player.pause') : t('player.play'), active: playing }, h(Icon, { d: playing ? ICONS.pause : ICONS.play, size: 16 })),
            h(Button, { onClick: onNext, title: t('player.next') }, h(Icon, { d: ICONS.next })),
            h('span', { className: 'dwp-time' }, `${formatTime(time)} / ${formatTime(duration)}`),
            h('span', { className: 'dwp-spacer' }),
            h(Button, { onClick: onToggleShuffle, title: t('player.shuffle'), active: shuffle }, h(Icon, { d: ICONS.shuffle })),
            h(Button, { onClick: onToggleLoop, title: t('player.loop'), active: loop }, h(Icon, { d: ICONS.loop })),
            h(Button, { onClick: onSetSpeed, title: t('player.speed') }, `${speed}×`),
            h(Button, { onClick: onToggleMute, title: muted ? t('player.unmute') : t('player.mute'), active: muted },
              muted
                ? h(
                    'svg',
                    { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' },
                    h('path', { d: ICONS.volume }),
                    h('path', { d: 'M15.5 8.5l5 5m0-5l-5 5', stroke: 'currentColor', strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' }),
                  )
                : h(Icon, { d: ICONS.volume }),
            ),
            h('input', {
              className: 'dwp-volume',
              type: 'range',
              min: 0,
              max: 1,
              step: 0.01,
              value: muted ? 0 : volume,
              onChange: (event) => onVolume(Number(event.target.value)),
              'aria-label': t('player.volume'),
            }),
            h(Button, { onClick: onFullscreen, title: t('player.fullscreen') }, h(Icon, { d: ICONS.fullscreen })),
          ),
        ),
      )
    }

    function Card({ item, active, onSelect }) {
      return h(
        'button',
        { type: 'button', className: `dwp-card${active ? ' is-active' : ''}`, onClick: onSelect, title: item.title },
        h(
          'div',
          { className: 'dwp-thumb' },
          item.previewUrl
            ? h('img', { src: item.previewUrl, alt: '', loading: 'lazy' })
            : h('div', { className: 'dwp-thumb-empty' }, t('state.noPreview')),
          h('span', { className: 'dwp-badge' }, t(kindKey(item.kind))),
        ),
        h('div', { className: 'dwp-card-title' }, item.title),
      )
    }

    function Section() {
      const [load, setLoad] = React.useState({ status: 'loading', data: null, error: null })
      const [query, setQuery] = React.useState('')
      const [kind, setKind] = React.useState('all')
      const [currentId, setCurrentId] = React.useState(null)
      const [playing, setPlaying] = React.useState(false)
      const [time, setTime] = React.useState(0)
      const [duration, setDuration] = React.useState(0)
      const [volume, setVolume] = React.useState(0.8)
      const [muted, setMuted] = React.useState(false)
      const [loop, setLoop] = React.useState(false)
      const [shuffle, setShuffle] = React.useState(false)
      const [speed, setSpeed] = React.useState(1)
      const [error, setError] = React.useState(false)

      const videoRef = React.useRef(null)
      const wrapRef = React.useRef(null)
      const stateRef = React.useRef({})
      const prefsRef = React.useRef(null)

      const loadLibrary = React.useCallback((refresh) => {
        setLoad((previous) => ({ ...previous, status: 'loading', error: null }))
        const url = refresh ? `${LIBRARY_URL}?refresh=1` : LIBRARY_URL
        window
          .fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return response.json()
          })
          .then((data) => {
            const items = Array.isArray(data.items) ? data.items : []
            setLoad({ status: 'ready', data: { ...data, items }, error: null })
            setCurrentId((previous) => {
              if (previous !== null && items.some((item) => item.id === previous)) return previous
              const pref = prefsRef.current
              if (pref && typeof pref.id === 'string' && items.some((item) => item.id === pref.id)) return pref.id
              const firstVideo = items.find((item) => item.playable && item.kind === 'video')
              return (firstVideo ?? items[0] ?? {}).id ?? null
            })
          })
          .catch((cause) => {
            setLoad({ status: 'error', data: null, error: cause instanceof Error ? cause.message : String(cause) })
          })
      }, [])

      React.useEffect(() => {
        const prefs = readPrefs()
        prefsRef.current = prefs
        if (prefs) {
          if (typeof prefs.volume === 'number' && prefs.volume >= 0 && prefs.volume <= 1) setVolume(prefs.volume)
          if (typeof prefs.muted === 'boolean') setMuted(prefs.muted)
          if (typeof prefs.loop === 'boolean') setLoop(prefs.loop)
          if (typeof prefs.shuffle === 'boolean') setShuffle(prefs.shuffle)
          if (typeof prefs.speed === 'number' && SPEEDS.includes(prefs.speed)) setSpeed(prefs.speed)
        }
        loadLibrary(false)
      }, [loadLibrary])

      const items = load.data && Array.isArray(load.data.items) ? load.data.items : []
      const current = items.find((item) => item.id === currentId) ?? items[0] ?? null

      const filtered = items.filter((item) => {
        if (kind !== 'all' && item.kind !== kind) return false
        if (query.trim() === '') return true
        const needle = query.trim().toLowerCase()
        return item.title.toLowerCase().includes(needle) || item.tags.some((tag) => tag.toLowerCase().includes(needle))
      })
      const playlist = filtered.length > 0 ? filtered : items

      const select = (id) => {
        setCurrentId(id)
        setTime(0)
        setDuration(0)
        setPlaying(false)
        setError(false)
      }

      const togglePlay = () => {
        const video = videoRef.current
        if (!video) return
        if (video.paused) {
          const result = video.play()
          if (result && typeof result.catch === 'function') result.catch(() => setPlaying(false))
        } else {
          video.pause()
        }
      }

      const seekBy = (delta) => {
        const video = videoRef.current
        if (!video || !Number.isFinite(video.duration)) return
        video.currentTime = Math.max(0, Math.min(video.duration - 0.05, video.currentTime + delta))
      }

      const toggleMute = () => setMuted((value) => !value)

      const cycleSpeed = () => {
        const index = SPEEDS.indexOf(speed)
        setSpeed(SPEEDS[(index + 1) % SPEEDS.length])
      }

      const toggleFullscreen = () => {
        const target = wrapRef.current
        if (!target) return
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {})
        } else if (typeof target.requestFullscreen === 'function') {
          target.requestFullscreen().catch(() => {})
        }
      }

      const step = (direction) => {
        if (playlist.length === 0) return
        const index = playlist.findIndex((item) => item.id === (current && current.id))
        const nextIndex = (index + direction + playlist.length) % playlist.length
        select(playlist[nextIndex].id)
      }

      const toggleShuffle = () => setShuffle((value) => !value)
      const toggleLoop = () => setLoop((value) => !value)

      React.useEffect(() => {
        const video = videoRef.current
        if (!video) return
        video.volume = muted ? 0 : volume
        video.muted = muted
      }, [volume, muted, currentId])

      React.useEffect(() => {
        const video = videoRef.current
        if (!video) return
        video.playbackRate = speed
      }, [speed, currentId])

      React.useEffect(() => {
        writePrefs({ volume, muted, loop, shuffle, speed })
      }, [volume, muted, loop, shuffle, speed])

      React.useEffect(() => {
        if (current === null) return
        writePrefs({ id: current.id })
      }, [current && current.id])

      React.useEffect(() => {
        const video = videoRef.current
        if (!video || current === null || current.kind !== 'video' || !current.playable) return
        setTime(0)
        setDuration(Number.isFinite(video.duration) ? video.duration : 0)
        const result = video.play()
        if (result && typeof result.catch === 'function') {
          result.catch(() => setPlaying(false))
        }
      }, [current && current.id])

      React.useEffect(() => {
        const onKeyDown = (event) => {
          const target = event.target
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
          if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
          const state = stateRef.current
          if (event.key === ' ' || event.code === 'Space') {
            if (!state.video) return
            event.preventDefault()
            state.togglePlay()
          } else if (event.key === 'ArrowLeft') {
            if (!state.video) return
            event.preventDefault()
            state.seekBy(-5)
          } else if (event.key === 'ArrowRight') {
            if (!state.video) return
            event.preventDefault()
            state.seekBy(5)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            state.setVolume((value) => Math.min(1, Math.round((value + 0.05) * 100) / 100))
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            state.setVolume((value) => Math.max(0, Math.round((value - 0.05) * 100) / 100))
          } else if (event.key === 'f' || event.key === 'F') {
            state.toggleFullscreen()
          } else if (event.key === 'm' || event.key === 'M') {
            state.toggleMute()
          } else if (event.key === 'n' || event.key === 'N') {
            state.step(1)
          } else if (event.key === 'p' || event.key === 'P') {
            state.step(-1)
          }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [])

      const video = Boolean(current && current.kind === 'video' && current.playable)

      stateRef.current = { togglePlay, seekBy, setVolume, toggleFullscreen, toggleMute, step, video }

      const subtitle = load.status === 'ready'
        ? (load.data.count > 0
            ? t('subtitle.info', { total: load.data.total ?? load.data.count, videos: load.data.videos ?? 0, scenes: load.data.scenes ?? 0 })
            : t('subtitle.none'))
        : load.status === 'error'
          ? t('state.errorHint')
          : t('state.loading')

      return h(
        'div',
        { className: 'dwp-root' },
        h(
          'div',
          { className: 'dwp-head' },
          h(
            'div',
            null,
            h('h3', { className: 'dwp-title' }, t('title.text')),
            h('div', { className: 'dwp-sub' }, subtitle),
          ),
          h(
            'button',
            { type: 'button', className: 'dwp-refresh', onClick: () => loadLibrary(true), title: t('action.refreshTitle') },
            t('action.refresh'),
          ),
        ),

        h(Player, {
          item: current,
          playing,
          onToggle: togglePlay,
          videoRef,
          wrapRef,
          time,
          duration,
          onSeek: (value) => {
            const element = videoRef.current
            if (element) element.currentTime = value
          },
          onLoaded: (event) => {
            setDuration(Number.isFinite(event.target.duration) ? event.target.duration : 0)
            setError(false)
          },
          onTime: (event) => setTime(event.target.currentTime || 0),
          onPlay: () => setPlaying(true),
          onPause: () => setPlaying(false),
          onError: () => {
            setError(true)
            setPlaying(false)
          },
          error,
          volume,
          muted,
          loop,
          speed,
          shuffle,
          onVolume: (value) => {
            setVolume(value)
            setMuted(value === 0)
          },
          onToggleMute: toggleMute,
          onToggleLoop: toggleLoop,
          onSetSpeed: cycleSpeed,
          onToggleShuffle: toggleShuffle,
          onPrev: () => step(-1),
          onNext: () => step(1),
          onFullscreen: toggleFullscreen,
        }),

        h(
          'div',
          { className: 'dwp-meta' },
          h('div', { className: 'dwp-name' }, current ? current.title : '—'),
          current
            ? h('span', { className: 'dwp-chip' }, t(kindKey(current.kind)))
            : null,
          current && current.kind === 'video'
            ? h('span', { className: 'dwp-chip' }, t(current.playable ? 'badge.playable' : 'badge.preview'))
            : null,
          current && current.contentRating
            ? h('span', { className: 'dwp-chip' }, current.contentRating)
            : null,
          ...(current && Array.isArray(current.tags)
            ? current.tags.slice(0, 4).map((tag) => h('span', { key: `tag-${tag}`, className: 'dwp-chip' }, tag))
            : []),
        ),

        h(
          'div',
          { className: 'dwp-toolbar' },
          h('input', {
            className: 'dwp-search',
            type: 'search',
            value: query,
            placeholder: t('search.placeholder'),
            onChange: (event) => setQuery(event.target.value),
            'aria-label': t('search.placeholder'),
          }),
          ...['all', 'video', 'scene', 'web', 'image'].map((value) =>
            h(
              'button',
              {
                key: value,
                type: 'button',
                className: `dwp-filter${kind === value ? ' is-on' : ''}`,
                onClick: () => setKind(value),
              },
              t(`filter.${value}`),
            ),
          ),
          h('span', { className: 'dwp-count' }, t('count.text', { n: filtered.length })),
        ),

        load.status === 'loading' && items.length === 0
          ? h('div', { className: 'dwp-empty' }, t('state.loading'))
          : null,

        load.status === 'error'
          ? h(
              'div',
              { className: 'dwp-empty' },
              h('strong', null, t('state.errorTitle')),
              h('div', null, t('state.errorHint')),
            )
          : null,

        load.status === 'ready' && filtered.length === 0
          ? h(
              'div',
              { className: 'dwp-empty' },
              h('strong', null, t('state.emptyTitle')),
              h('div', null, t('state.emptyHint')),
            )
          : null,

        filtered.length > 0
          ? h(
              'div',
              { className: 'dwp-grid' },
              ...filtered.map((item) =>
                h(Card, {
                  key: item.id,
                  item,
                  active: current !== null && item.id === current.id,
                  onSelect: () => select(item.id),
                }),
              ),
            )
          : null,
      )
    }

    const STYLE_ID = 'dsh-wallpaper-player-style'

    const CSS = `
      .dwp-root { display:flex; flex-direction:column; gap:14px; color:var(--dsw-alias-label-primary,#e8ecf5); font-size:13px; }
      .dwp-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
      .dwp-title { margin:0; font-size:16px; font-weight:600; }
      .dwp-sub { margin-top:4px; font-size:12px; line-height:1.5; color:var(--dsw-alias-label-tertiary,#8b93a7); word-break:break-word; }
      .dwp-refresh { flex:none; height:28px; padding:0 12px; border-radius:7px; font-size:12px; cursor:pointer;
        color:var(--dsw-alias-label-primary,#e8ecf5); background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.05));
        border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1)); }
      .dwp-refresh:hover { background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.09)); }
      .dwp-player { position:relative; aspect-ratio:16/9; border-radius:10px; overflow:hidden; background:#05070c;
        border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.09)); }
      .dwp-video { display:block; width:100%; height:100%; object-fit:contain; background:#000; }
      .dwp-scene { position:absolute; inset:0; }
      .dwp-poster { display:block; width:100%; height:100%; object-fit:cover; }
      .dwp-scene-overlay { position:absolute; inset:auto 0 0 0; padding:12px; background:linear-gradient(transparent, rgba(0,0,0,.78)); }
      .dwp-note { display:inline-block; padding:6px 10px; border-radius:8px; font-size:12px; line-height:1.4; color:#e3eaf7;
        background:rgba(6,10,20,.72); border:1px solid rgba(255,255,255,.14); }
      .dwp-center-play { position:absolute; inset:0; margin:auto; width:64px; height:64px; border-radius:50%;
        display:flex; align-items:center; justify-content:center; cursor:pointer; color:#fff;
        background:rgba(8,12,22,.62); border:1px solid rgba(255,255,255,.22); }
      .dwp-center-play:hover { background:rgba(8,12,22,.82); }
      .dwp-error-box { position:absolute; left:0; right:0; bottom:0; padding:10px 12px; background:rgba(30,8,8,.82); }
      .dwp-error { color:var(--dsw-alias-state-error-primary,#f87171); font-size:12px; }
      .dwp-loading { display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:#8b93a7; font-size:12px; }
      .dwp-controls { display:flex; flex-direction:column; gap:6px; }
      .dwp-progress { width:100%; accent-color:var(--dsw-alias-brand-primary,#22d3ee); height:16px; cursor:pointer; }
      .dwp-progress:disabled { cursor:default; opacity:.5; }
      .dwp-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
      .dwp-btn { appearance:none; display:inline-flex; align-items:center; justify-content:center; height:28px; min-width:28px;
        padding:0 6px; border-radius:7px; border:1px solid transparent; background:transparent; color:inherit; cursor:pointer; font-size:12px; }
      .dwp-btn:hover { background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08)); }
      .dwp-btn.is-on { color:var(--dsw-alias-brand-primary,#22d3ee); }
      .dwp-time { font-size:11px; color:var(--dsw-alias-label-tertiary,#8b93a7); font-variant-numeric:tabular-nums; }
      .dwp-spacer { flex:1; }
      .dwp-volume { width:76px; accent-color:var(--dsw-alias-brand-primary,#22d3ee); height:16px; cursor:pointer; }
      .dwp-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
      .dwp-name { flex:1 0 100%; font-size:14px; font-weight:600; word-break:break-word; }
      .dwp-chip { font-size:11px; padding:2px 8px; border-radius:999px; color:var(--dsw-alias-label-secondary,#a9b2c7);
        border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1)); }
      .dwp-toolbar { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
      .dwp-search { flex:1 1 160px; min-width:120px; height:30px; padding:0 10px; border-radius:8px; font-size:12px;
        color:var(--dsw-alias-label-primary,#e8ecf5); background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.05));
        border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1)); outline:none; }
      .dwp-search:focus { border-color:var(--dsw-alias-border-selected,rgba(34,211,238,.6)); }
      .dwp-filter { height:26px; padding:0 10px; border-radius:999px; font-size:11px; cursor:pointer;
        color:var(--dsw-alias-label-secondary,#a9b2c7); background:transparent;
        border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1)); }
      .dwp-filter:hover { background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08)); }
      .dwp-filter.is-on { color:#04121a; background:var(--dsw-alias-brand-primary,#22d3ee); border-color:transparent; }
      .dwp-count { margin-left:auto; font-size:11px; color:var(--dsw-alias-label-tertiary,#8b93a7); }
      .dwp-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .dwp-card { display:flex; flex-direction:column; gap:6px; padding:0; background:none; border:none; color:inherit;
        text-align:left; cursor:pointer; }
      .dwp-thumb { position:relative; aspect-ratio:16/9; border-radius:8px; overflow:hidden; background:linear-gradient(135deg,#111726,#1b2335);
        border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.09)); }
      .dwp-card.is-active .dwp-thumb { border-color:var(--dsw-alias-brand-primary,#22d3ee); box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary,#22d3ee); }
      .dwp-thumb img { display:block; width:100%; height:100%; object-fit:cover; }
      .dwp-thumb-empty { display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:#59627a; font-size:11px; }
      .dwp-badge { position:absolute; top:6px; left:6px; padding:2px 7px; border-radius:999px; font-size:10px; color:#dbe4f5;
        background:rgba(5,10,20,.72); border:1px solid rgba(255,255,255,.14); }
      .dwp-card-title { font-size:12px; color:var(--dsw-alias-label-secondary,#a9b2c7); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dwp-empty { padding:20px; border-radius:10px; text-align:center; font-size:12px; line-height:1.6; color:var(--dsw-alias-label-tertiary,#8b93a7);
        border:1px dashed var(--dsw-alias-border-l1,rgba(255,255,255,.12)); }
      .dwp-empty strong { display:block; margin-bottom:6px; font-size:13px; color:var(--dsw-alias-label-secondary,#a9b2c7); }
    `

    function installStyle() {
      if (typeof document === 'undefined') return () => {}
      const head = document.head || document.documentElement
      let element = document.getElementById(STYLE_ID)
      if (element === null) {
        element = document.createElement('style')
        element.id = STYLE_ID
        element.textContent = CSS
        head.appendChild(element)
      }
      return () => {
        if (element.parentNode) element.parentNode.removeChild(element)
      }
    }

    return {
      name: 'dsh-wallpaper-player',
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          try {
            if (ctx.locale && typeof ctx.locale.register === 'function') {
              const dispose = ctx.locale.register(NS, DICTS)
              if (typeof ctx.locale.bind === 'function') translate = ctx.locale.bind(NS)
              return () => {
                translate = buildFallback()
                if (typeof dispose === 'function') dispose()
              }
            }
          } catch (cause) {
            console.warn('[wallpaper-player] locale registration failed', cause)
          }
          return () => {}
        }, 'wallpaper-player: locale')

        ctx.effect(installStyle, 'wallpaper-player: styles')

        ctx.effect(() => {
          const dispose = ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              {
                name: 'settings.section',
                id: 'wallpaper-player',
                order: 510,
                label: () => t('nav.label'),
              },
              Section,
            ),
          )
          return () => {
            if (typeof dispose === 'function') dispose()
          }
        }, 'wallpaper-player: settings section')
      },
    }
  },
})
