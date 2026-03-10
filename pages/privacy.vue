<template>
  <div class="policy-page">
    <div class="policy-container">
      <h1>隐私政策</h1>
      <p class="update-date">最后更新日期：2026 年 3 月 6 日</p>

      <section>
        <h2>引言</h2>
        <p>
          Elephant Todo（以下简称「我们」）非常重视您的隐私。本隐私政策说明了我们如何收集、使用、存储和保护您的个人信息。
          使用我们的服务即表示您同意本隐私政策中描述的做法。
        </p>
      </section>

      <section>
        <h2>一、我们收集的信息</h2>
        <h3>1.1 账户信息</h3>
        <ul>
          <li><strong>邮箱地址</strong>：用于注册、登录和密码重置</li>
          <li><strong>用户名</strong>：用于在应用内标识您的身份</li>
          <li><strong>密码</strong>：经 bcrypt 加密后存储，我们无法查看您的明文密码</li>
        </ul>

        <h3>1.2 用户生成内容</h3>
        <ul>
          <li><strong>待办事项</strong>：标题、描述、优先级、截止日期、子任务等</li>
          <li><strong>随手记</strong>：您记录的文字内容</li>
          <li><strong>记账记录</strong>：收支金额、分类、备注</li>
          <li><strong>重要日期</strong>：纪念日、生日等日期信息</li>
        </ul>

        <h3>1.3 加密存储的敏感数据</h3>
        <ul>
          <li><strong>密码本</strong>：您存储的账号密码信息使用 AES-256-GCM 端到端加密，加密和解密均在您的设备上完成。我们的服务器仅存储加密后的密文，无法查看您的原始数据</li>
        </ul>

        <h3>1.4 健康相关数据</h3>
        <ul>
          <li><strong>经期记录</strong>：经期开始/结束日期、周期天数、症状记录。这些数据仅用于周期预测和统计功能，存储在我们的服务器上，不会与任何第三方共享</li>
        </ul>

        <h3>1.5 我们不收集的信息</h3>
        <ul>
          <li>我们不收集您的地理位置信息</li>
          <li>我们不收集您的通讯录或联系人信息</li>
          <li>我们不收集您的照片或相册内容</li>
          <li>我们不使用任何第三方分析或广告 SDK</li>
          <li>我们不会将您的数据用于广告投放</li>
        </ul>
      </section>

      <section>
        <h2>二、我们如何使用您的信息</h2>
        <ul>
          <li>提供和维护应用的核心功能</li>
          <li>验证您的身份并保护账户安全</li>
          <li>发送密码重置邮件（仅在您主动请求时）</li>
          <li>提供 AI 智能建议功能（如您使用该功能，相关待办内容会发送至 AI 服务接口进行分析，不会用于其他目的）</li>
        </ul>
      </section>

      <section>
        <h2>三、数据存储与安全</h2>
        <h3>3.1 数据存储</h3>
        <p>您的数据存储在位于中国大陆的阿里云服务器上，受到以下安全措施保护：</p>
        <ul>
          <li>数据库不暴露公网端口，仅通过内网访问</li>
          <li>应用通过 Nginx 反向代理，支持 HTTPS 加密传输</li>
          <li>用户密码使用 bcrypt 算法加密存储</li>
          <li>密码本数据使用 AES-256-GCM 端到端加密</li>
          <li>认证采用 JWT Token 机制，Token 定期刷新</li>
        </ul>

        <h3>3.2 健康数据保护</h3>
        <p>经期追踪等健康相关数据受到与其他用户数据同等的安全保护。我们不会将健康数据与第三方共享，也不会将其用于任何非功能性目的。</p>
      </section>

      <section>
        <h2>四、数据共享</h2>
        <p>我们不会向任何第三方出售、出租或交易您的个人信息。以下情况除外：</p>
        <ul>
          <li>经您明确同意</li>
          <li>法律法规要求的情况</li>
          <li>为保护我们的合法权益而必要的情况</li>
        </ul>
      </section>

      <section>
        <h2>五、您的权利</h2>
        <p>您有权：</p>
        <ul>
          <li>访问和导出您的个人数据</li>
          <li>更正不准确的个人信息</li>
          <li>删除您的账户及相关数据</li>
          <li>随时停止使用我们的服务</li>
        </ul>
        <p>如需行使上述权利，请通过以下联系方式与我们联系。</p>
      </section>

      <section>
        <h2>六、未成年人保护</h2>
        <p>我们的服务面向一般用户。如果您是未满 14 周岁的未成年人，请在监护人的陪同和指导下使用本服务。</p>
      </section>

      <section>
        <h2>七、隐私政策更新</h2>
        <p>我们可能会不时更新本隐私政策。更新后的政策将在应用内和网站上公布，重大变更时我们会通过适当方式通知您。</p>
      </section>

      <section>
        <h2>八、联系我们</h2>
        <p>如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：</p>
        <ul>
          <li>邮箱：support@elephantodo.com</li>
        </ul>
      </section>

      <div class="back-link">
        <NuxtLink to="/login">← 返回登录</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

useHead({
  title: '隐私政策 — Elephant Todo',
})
</script>

<style lang="scss" scoped>
.policy-page {
  min-height: 100vh;
  background: var(--color-bg);
  padding: 24px 16px;
  padding-top: calc(24px + var(--safe-area-top));
  padding-bottom: calc(24px + var(--safe-area-bottom));
}

.policy-container {
  max-width: 720px;
  margin: 0 auto;
  color: var(--color-text);

  h1 {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .update-date {
    color: var(--color-text-secondary);
    font-size: 13px;
    margin-bottom: 32px;
  }

  section {
    margin-bottom: 28px;
  }

  h2 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  h3 {
    font-size: 15px;
    font-weight: 600;
    margin: 12px 0 8px;
  }

  p {
    font-size: 14px;
    line-height: 1.8;
    margin-bottom: 8px;
  }

  ul {
    padding-left: 20px;
    margin-bottom: 8px;

    li {
      font-size: 14px;
      line-height: 1.8;
    }
  }

  .back-link {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid var(--color-border);

    a {
      color: var(--color-primary);
      text-decoration: none;
      font-size: 14px;
    }
  }
}
</style>
