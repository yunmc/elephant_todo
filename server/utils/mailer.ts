import nodemailer from 'nodemailer'

let _transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    const config = useRuntimeConfig()
    _transporter = nodemailer.createTransport({
      host: config.smtpHost as string,
      port: Number(config.smtpPort),
      secure: config.smtpSecure === 'true',
      auth: {
        user: config.smtpUser as string,
        pass: config.smtpPass as string,
      },
    })
  }
  return _transporter
}

export async function sendResetPasswordEmail(to: string, token: string): Promise<void> {
  const config = useRuntimeConfig()
  const resetUrl = `${config.resetPasswordUrl}?token=${token}`

  await getTransporter().sendMail({
    from: config.smtpFrom as string,
    to,
    subject: 'Elephant Todo — 密码重置',
    html: `
      <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
        <h2>密码重置</h2>
        <p>您请求了密码重置，请点击以下链接设置新密码：</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">重置密码</a></p>
        <p>此链接将在 1 小时后过期。</p>
        <p>如果您没有请求密码重置，请忽略此邮件。</p>
        <hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb;" />
        <p style="color:#6b7280;font-size:12px;">Elephant Todo App</p>
      </div>
    `,
  })
}
