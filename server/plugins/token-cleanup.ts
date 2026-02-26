/**
 * Server plugin: cleanup expired password reset tokens daily.
 * Runs every 24 hours after a 1-minute initial delay.
 */
export default defineNitroPlugin(() => {
  // 1 minute after server start, then every 24 hours
  setTimeout(async () => {
    try {
      await UserModel.cleanupExpiredResetTokens()
      console.log('[Cleanup] Expired password reset tokens cleaned')
    } catch (err) {
      console.error('[Cleanup] Failed to clean expired tokens:', err)
    }

    setInterval(async () => {
      try {
        await UserModel.cleanupExpiredResetTokens()
        console.log('[Cleanup] Expired password reset tokens cleaned')
      } catch (err) {
        console.error('[Cleanup] Failed to clean expired tokens:', err)
      }
    }, 24 * 60 * 60 * 1000)
  }, 60 * 1000)
})
