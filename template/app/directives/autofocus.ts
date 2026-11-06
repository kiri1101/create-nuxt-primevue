import type { Directive } from 'vue'

// v-autofocus: focus the element once it is mounted.
const autofocus: Directive<HTMLElement> = {
  mounted(el) {
    el.focus()
  },
}

export default autofocus
