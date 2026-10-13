import { ref, computed, watch, onScopeDispose } from 'vue'

// Snapshot-based undo/redo. Edits are grouped: a snapshot is taken 500 ms after the last change.
export function createHistory(get, set) {
  const stack = ref([JSON.stringify(get())])
  const i = ref(0)
  let timer = null
  let silent = false

  function push() {
    const s = JSON.stringify(get())
    if (s === stack.value[i.value]) return
    stack.value = stack.value.slice(0, i.value + 1).concat(s).slice(-60)
    i.value = stack.value.length - 1
  }
  const stop = watch(get, () => {
    if (silent) { silent = false; return }
    clearTimeout(timer)
    timer = setTimeout(push, 500)
  }, { deep: true })
  onScopeDispose(() => { stop(); clearTimeout(timer) })

  function apply(idx) {
    silent = true
    i.value = idx
    set(JSON.parse(stack.value[idx]))
  }
  function undo() { clearTimeout(timer); push(); if (i.value > 0) apply(i.value - 1) }
  function redo() { clearTimeout(timer); if (i.value < stack.value.length - 1) apply(i.value + 1) }
  return { undo, redo, canUndo: computed(() => i.value > 0 || JSON.stringify(get()) !== stack.value[i.value]), canRedo: computed(() => i.value < stack.value.length - 1) }
}
