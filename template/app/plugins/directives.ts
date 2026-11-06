import autofocus from '~/directives/autofocus'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('autofocus', autofocus)
})
