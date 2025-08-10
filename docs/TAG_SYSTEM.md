# 標籤系統 API 文檔

## 概述

標籤系統允許用戶為照片添加風格標籤，支持多對多關聯。系統預設了10種時尚風格標籤。

## 預設標籤

| 標籤名稱   | 英文名稱   | Emoji | 顏色    | 描述           |
| ---------- | ---------- | ----- | ------- | -------------- |
| 運動風     | sporty     | 🏃‍♀️    | #FF6B35 | 運動休閒風格   |
| 街頭潮流   | streetwear | 🛹    | #2E86AB | 街頭時尚風格   |
| 復古風     | vintage    | 📻    | #A23B72 | 復古懷舊風格   |
| 簡約風     | minimalist | ⚪    | #F18F01 | 簡約現代風格   |
| 正式風     | formal     | 👔    | #C73E1D | 正式商務風格   |
| 甜美風     | coquette   | 🎀    | #FFB3C6 | 甜美可愛風格   |
| 戶外機能風 | gorpcore   | 🏔️    | #4A5D23 | 戶外機能風格   |
| Y2K千禧風  | y2k        | 💿    | #9B59B6 | 千禧年復古風格 |
| 學院風     | preppy     | 📚    | #3498DB | 學院派風格     |
| 暗黑風     | darkwear   | 🖤    | #2C3E50 | 暗黑哥特風格   |

## API 端點

### 1. 獲取所有標籤

```http
GET /api/tags
```

**查詢參數:**

- `category` (可選): 按分類篩選標籤

**響應:**

```json
{
  "success": true,
  "data": [
    {
      "id": "tag_id",
      "name": "sporty",
      "displayName": "運動風",
      "emoji": "🏃‍♀️",
      "color": "#FF6B35",
      "category": "style",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 2. 獲取熱門標籤

```http
GET /api/tags/popular?limit=10
```

**查詢參數:**

- `limit` (可選): 返回標籤數量，默認10

**響應:**

```json
{
  "success": true,
  "data": [
    {
      "id": "tag_id",
      "name": "sporty",
      "displayName": "運動風",
      "emoji": "🏃‍♀️",
      "color": "#FF6B35",
      "category": "style",
      "_count": {
        "photoTags": 15
      }
    }
  ]
}
```

### 3. 為照片添加標籤 (需要認證)

```http
POST /api/tags/photos/:photoId
Authorization: Bearer <token>
```

**請求體:**

```json
{
  "tagIds": ["tag_id_1", "tag_id_2", "tag_id_3"]
}
```

**響應:**

```json
{
  "success": true,
  "message": "標籤添加成功"
}
```

### 4. 獲取照片的標籤

```http
GET /api/tags/photos/:photoId
```

**響應:**

```json
{
  "success": true,
  "data": [
    {
      "id": "tag_id",
      "name": "sporty",
      "displayName": "運動風",
      "emoji": "🏃‍♀️",
      "color": "#FF6B35",
      "category": "style"
    }
  ]
}
```

### 5. 根據標籤搜索照片

```http
GET /api/tags/search?tagIds[]=tag_id_1&tagIds[]=tag_id_2&limit=20&offset=0
```

**查詢參數:**

- `tagIds[]`: 標籤ID數組 (必需)
- `limit` (可選): 返回照片數量，默認20
- `offset` (可選): 偏移量，默認0

**響應:**

```json
{
  "success": true,
  "data": [
    {
      "id": "photo_id",
      "userId": "user_id",
      "key": "photos/user_id/timestamp.jpg",
      "url": "https://example.com/photo.jpg",
      "uploadedAt": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": "user_id",
        "name": "用戶名",
        "avatar": "avatar_url"
      },
      "photoTags": [
        {
          "tag": {
            "id": "tag_id",
            "name": "sporty",
            "displayName": "運動風",
            "emoji": "🏃‍♀️"
          }
        }
      ],
      "_count": {
        "ratings": 5
      }
    }
  ]
}
```

### 6. 創建新標籤 (需要認證)

```http
POST /api/tags
Authorization: Bearer <token>
```

**請求體:**

```json
{
  "name": "casual",
  "displayName": "休閒風",
  "emoji": "👕",
  "color": "#3498DB",
  "category": "style"
}
```

**響應:**

```json
{
  "success": true,
  "data": {
    "id": "new_tag_id",
    "name": "casual",
    "displayName": "休閒風",
    "emoji": "👕",
    "color": "#3498DB",
    "category": "style",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## 數據庫結構

### Tag 表

- `id`: 標籤唯一ID
- `name`: 英文名稱 (唯一)
- `displayName`: 中文顯示名稱
- `emoji`: 表情符號 (可選)
- `color`: 十六進制顏色代碼 (可選)
- `category`: 分類 (可選)
- `createdAt`: 創建時間

### PhotoTag 表 (關聯表)

- `id`: 關聯記錄ID
- `photoId`: 照片ID
- `tagId`: 標籤ID
- 唯一約束: `(photoId, tagId)`

## 使用示例

### 前端 JavaScript 示例

```javascript
// 獲取所有標籤
const getTags = async () => {
  const response = await fetch("/api/tags");
  const result = await response.json();
  return result.data;
};

// 為照片添加標籤
const addTagsToPhoto = async (photoId, tagIds, token) => {
  const response = await fetch(`/api/tags/photos/${photoId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tagIds }),
  });
  return await response.json();
};

// 根據標籤搜索照片
const searchPhotosByTags = async (tagIds) => {
  const params = new URLSearchParams();
  tagIds.forEach((id) => params.append("tagIds[]", id));

  const response = await fetch(`/api/tags/search?${params}`);
  const result = await response.json();
  return result.data;
};
```

## 初始化腳本

運行以下命令來初始化預設標籤:

```bash
npx tsx scripts/init-tags.ts
```

## 測試腳本

運行以下命令來測試標籤系統:

```bash
npx tsx scripts/test-tags.ts
```
