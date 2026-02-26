/**
 * Composable for voice input using Web Speech API.
 * Falls back gracefully if not supported.
 */
export function useVoiceInput() {
  const isListening = ref(false)
  const transcript = ref('')
  const error = ref<string | null>(null)
  const isSupported = ref(false)

  let recognition: any = null

  onMounted(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      isSupported.value = true
      recognition = new SpeechRecognition()
      recognition.lang = 'zh-CN'
      recognition.continuous = false
      recognition.interimResults = true

      recognition.onresult = (event: any) => {
        const results = event.results
        transcript.value = results[results.length - 1][0].transcript
      }

      recognition.onerror = (event: any) => {
        error.value = `语音识别错误: ${event.error}`
        isListening.value = false
      }

      recognition.onend = () => {
        isListening.value = false
      }
    }
  })

  function start() {
    if (!recognition) {
      error.value = '您的浏览器不支持语音识别'
      return
    }
    error.value = null
    transcript.value = ''
    recognition.start()
    isListening.value = true
  }

  function stop() {
    if (recognition && isListening.value) {
      recognition.stop()
      isListening.value = false
    }
  }

  return {
    isListening: readonly(isListening),
    transcript: readonly(transcript),
    error: readonly(error),
    isSupported: readonly(isSupported),
    start,
    stop,
  }
}
