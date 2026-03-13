<template>
  <div class="policy-page">
    <div class="policy-container">
      <h1>用户协议</h1>
      <p class="update-date">最后更新日期：2026 年 3 月 6 日</p>

      <section>
        <h2>一、服务说明</h2>
        <p>
          Elephant Todo 是一款个人效率管理工具，提供待办管理、随手记、密码本、记账、重要日期提醒、经期追踪等功能。
          本协议适用于您使用 Elephant Todo 应用及相关服务。
        </p>
      </section>

      <section>
        <h2>二、账户注册</h2>
        <ul>
          <li>您需要使用有效的邮箱地址注册账户</li>
          <li>您有责任保管好自己的账户密码</li>
          <li>您对账户下的所有活动承担责任</li>
        </ul>
      </section>

      <section>
        <h2>三、用户行为规范</h2>
        <p>使用本服务时，您同意：</p>
        <ul>
          <li>不利用本服务从事任何违法违规活动</li>
          <li>不上传包含恶意代码的内容</li>
          <li>不尝试未经授权访问其他用户的数据</li>
          <li>不对本服务进行反向工程或恶意攻击</li>
        </ul>
      </section>

      <section>
        <h2>四、知识产权</h2>
        <p>Elephant Todo 应用的设计、代码、图标等知识产权归开发者所有。您创建的内容（待办、笔记等）的所有权归您所有。</p>
      </section>

      <section>
        <h2>五、服务变更与终止</h2>
        <ul>
          <li>我们保留随时修改或终止服务的权利</li>
          <li>重大变更会提前通知用户</li>
          <li>您可以随时删除账户并停止使用服务</li>
        </ul>
      </section>

      <section>
        <h2>六、免责声明</h2>
        <ul>
          <li>本服务按「现状」提供，不做任何明示或暗示的保证</li>
          <li>我们不对因使用本服务造成的数据丢失承担责任</li>
          <li>建议您定期备份重要数据</li>
        </ul>
      </section>

      <section>
        <h2>七、协议修改</h2>
        <p>我们保留修改本协议的权利。修改后的协议将在应用内公布，继续使用本服务即视为同意修改后的协议。</p>
      </section>

      <section>
        <h2>八、联系方式</h2>
        <p>如有任何问题，请联系：support@elephantodo.com</p>
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

useHead({
  title: '用户协议 — Elephant Todo',
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

}
</style>
