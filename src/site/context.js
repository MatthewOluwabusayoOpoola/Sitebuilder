import { inject, provide } from 'vue'
const KEY = Symbol('site-ctx')
export const provideSite = (ctx) => provide(KEY, ctx)
export const useSiteCtx = () => inject(KEY)
