/**
 * dsh-wallpaper-player — host half.
 *
 * Serves the local Wallpaper Engine library over the DSH web server. The
 * client half (client.js) renders the player page under Settings → 壁纸播放器.
 */

import { createLibrary } from './lib/library.js'
import { createRoutes } from './lib/routes.js'

export const name = 'wallpaper-player'

export const inject = ['webServer']

export function apply(ctx, config) {
  const library = createLibrary(config)
  const routes = createRoutes(library)

  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'prefix',
      path: '/wallpaper-player',
      handler: routes,
    })
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  }, 'wallpaper-player: http routes')
}
