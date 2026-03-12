# 阿里云 OSS 存储规范

## Bucket 信息

| 项目 | 值 |
|------|-----|
| Bucket | `elephant-todo` |
| Region | `oss-cn-beijing`（华北2 北京） |
| 访问权限 | 公共读、私有写 |
| Endpoint | `https://oss-cn-beijing.aliyuncs.com` |

## 目录结构

```
elephant-todo/                              # Bucket 根目录
│
├── attachments/{userId}/{YYYYMMDD}/        # 用户记录附件（Premium 功能）
│   └── {16位hex}.{ext}
│
├── products/{productType}/                 # 商店商品预览图（Admin 上传）
│   └── {productId}_{16位hex}.{ext}
│
├── pets/sprites/{skinId}/                  # AI 宠物精灵图（Admin 上传）
│   └── {state}.png
│
├── stickers/{packId}/                      # 贴纸包素材（Admin 上传）
│   └── {name}.png
│
└── fonts/                                  # 自定义字体（Admin 上传）
    └── {fontId}_{name}.{woff2|ttf}
```

## 各分类详细规则

### 1. 用户记录附件 `attachments/`

- **用途**：财务记录、随手记、待办事项的图片附件
- **上传者**：Premium 用户
- **路径格式**：`attachments/{userId}/{YYYYMMDD}/{16位随机hex}.{ext}`
- **示例**：`attachments/42/20260312/a1b2c3d4e5f6g7h8.jpg`
- **格式限制**：JPG / PNG / GIF / WebP
- **大小限制**：单张 ≤ 5MB
- **数量限制**：每条记录最多 3 张
- **生成函数**：`ossKeyAttachment(userId, filename)`
- **特点**：按用户 ID + 日期分目录，文件名随机散列，防止冲突和隐私泄露

### 2. 商品预览图 `products/`

- **用途**：商店中皮肤、贴纸包、字体、宠物皮肤、套装的展示封面
- **上传者**：Admin 管理员
- **路径格式**：`products/{type}/{productId}_{16位随机hex}.{ext}`
- **示例**：`products/skin/15_c3d4e5f6a1b2c3d4.png`
- **格式限制**：JPG / PNG / WebP
- **大小限制**：单张 ≤ 2MB
- **生成函数**：`ossKeyProduct(productType, productId, filename)`
- **`type` 取值**：`skin` / `sticker_pack` / `font` / `pet_skin` / `bundle`

### 3. 宠物精灵图 `pets/sprites/`

- **用途**：AI 宠物各状态动画的精灵图资源
- **上传者**：Admin 管理员
- **路径格式**：`pets/sprites/{skinId}/{state}.png`
- **示例**：`pets/sprites/pink-heart/happy.png`
- **格式限制**：PNG
- **大小限制**：单张 ≤ 1MB
- **生成函数**：`ossKeyPetSprite(skinId, state)`
- **`state` 取值**：`idle` / `happy` / `eating` / `hungry` / `sleeping` 等

### 4. 贴纸包素材 `stickers/`

- **用途**：用户购买的贴纸包中的贴纸图片
- **上传者**：Admin 管理员
- **路径格式**：`stickers/{packId}/{name}.png`
- **示例**：`stickers/3/star.png`
- **格式限制**：PNG / WebP
- **大小限制**：单张 ≤ 500KB
- **生成函数**：`ossKeySticker(packId, name)`

### 5. 字体文件 `fonts/`

- **用途**：用户购买的自定义字体
- **上传者**：Admin 管理员
- **路径格式**：`fonts/{fontId}_{name}.{ext}`
- **示例**：`fonts/7_cute-handwriting.woff2`
- **格式限制**：WOFF2 / TTF
- **大小限制**：单文件 ≤ 5MB
- **生成函数**：`ossKeyFont(fontId, name, filename)`

## 命名规范

1. **路径全部小写**，不含中文、空格、特殊字符
2. **用户上传**：文件名为 16 位随机 hex（`crypto.randomBytes(8).toString('hex')`），不暴露原始文件名
3. **管理员上传**：文件名含资源 ID，便于关联和排查
4. **扩展名**：取原始文件名扩展名并转为小写，仅允许白名单内格式
5. **不复用旧 key**：删除文件后 key 不回收，新上传始终生成新 key

## 安全规则

1. **Bucket 权限**：公共读 + 私有写（用户可直接通过 URL 访问图片，但无法直接上传）
2. **AK/SK 管理**：仅存放在 `.env` 文件中，禁止提交到 Git
3. **服务端中转**：前端不直接调用 OSS API，所有上传请求经由 Nuxt Server API 中转
4. **身份校验**：
   - 用户上传 → 必须验证 JWT + Premium 身份
   - 管理员上传 → 必须验证 Admin 身份
5. **文件校验**：服务端二次校验 MIME 类型和文件大小，不信任前端传值
6. **RAM 子用户**：使用专用 RAM 子用户，仅授予本 Bucket 的读写权限

## 代码入口

所有 OSS key 生成函数统一在 `server/utils/oss.ts` 中维护：

```typescript
ossKeyAttachment(userId, filename)              // 用户附件
ossKeyProduct(productType, productId, filename) // 商品预览
ossKeyPetSprite(skinId, state)                  // 宠物精灵图
ossKeySticker(packId, name)                     // 贴纸素材
ossKeyFont(fontId, name, filename)              // 字体文件
validateUploadFile(mimeType, size, category)    // 统一文件校验
uploadToOss(key, buffer, mimeType)              // 上传
deleteFromOss(key)                              // 删除
```

**禁止在其他文件中手工拼接 OSS 路径。**
