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
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null
  const VOICE_TIMEOUT_MS = 15000 // 15 seconds max

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
        const errorMap: Record<string, string> = {
          'not-allowed': '麦克风权限被拒绝',
          'no-speech': '未检测到语音',
          'network': '网络错误',
          'audio-capture': '无法访问麦克风',
          'aborted': '语音识别已取消',
        }
        error.value = errorMap[event.error] || `语音识别错误: ${event.error}`
        clearVoiceTimeout()
        isListening.value = false
      }

      recognition.onend = () => {
        clearVoiceTimeout()
        isListening.value = false
      }
    }
  })

  onUnmounted(() => {
    // Cleanup: abort recognition if still running
    if (recognition && isListening.value) {
      recognition.abort()
      isListening.value = false
    }
    clearVoiceTimeout()
  })

  function clearVoiceTimeout() {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer)
      timeoutTimer = null
    }
  }

  function start() {
    if (!recognition) {
      error.value = '您的浏览器不支持语音识别'
      return
    }
    // Guard against double-start
    if (isListening.value) return

    error.value = null
    transcript.value = ''
    try {
      recognition.start()
      isListening.value = true

      // Auto-stop after timeout
      clearVoiceTimeout()
      timeoutTimer = setTimeout(() => {
        if (isListening.value) {
          recognition.stop()
          isListening.value = false
          if (!transcript.value) {
            error.value = '语音识别超时，未检测到内容'
          }
        }
      }, VOICE_TIMEOUT_MS)
    } catch {
      // recognition.start() can throw if already started
      isListening.value = false
    }
  }

  function stop() {
    if (recognition && isListening.value) {
      clearVoiceTimeout()
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
