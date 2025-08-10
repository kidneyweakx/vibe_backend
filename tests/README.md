# 測試文檔

這個目錄包含了完整的測試套件，涵蓋了標籤系統和照片系統的所有功能。

## 測試結構

```
tests/
├── setup.ts              # 測試設置和工具函數
├── tag.service.test.ts    # TagService 單元測試
├── tag.api.test.ts        # Tag API 端點測試
├── photo.service.test.ts  # Photo Service 單元測試
├── photo.api.test.ts      # Photo API 端點測試
├── integration.test.ts    # 整合測試
└── README.md             # 本文檔
```

## 運行測試

### 運行所有測試

```bash
bun test
```

### 運行特定測試文件

```bash
bun test tests/tag.service.test.ts
bun test tests/photo.api.test.ts
```

### 監視模式運行測試

```bash
bun test --watch
```

### 運行測試並生成覆蓋率報告

```bash
bun test --coverage
```

## 測試覆蓋範圍

### TagService 測試 (`tag.service.test.ts`)

- ✅ 獲取所有標籤
- ✅ 按分類篩選標籤
- ✅ 為照片添加標籤
- ✅ 替換現有標籤
- ✅ 獲取照片標籤
- ✅ 根據標籤搜索照片
- ✅ 分頁和排序
- ✅ 獲取熱門標籤
- ✅ 創建新標籤
- ✅ 更新標籤
- ✅ 刪除標籤及其關聯

### Tag API 測試 (`tag.api.test.ts`)

- ✅ GET /tags - 獲取標籤列表
- ✅ GET /tags/popular - 獲取熱門標籤
- ✅ POST /tags/photos/:photoId - 為照片添加標籤
- ✅ GET /tags/photos/:photoId - 獲取照片標籤
- ✅ GET /tags/search - 根據標籤搜索照片
- ✅ POST /tags - 創建新標籤
- ✅ 權限驗證
- ✅ 輸入驗證
- ✅ 錯誤處理

### Photo Service 測試 (`photo.service.test.ts`)

- ✅ R2 文件上傳
- ✅ 文件類型和大小驗證
- ✅ 照片上傳（用戶和訪客）
- ✅ 獲取用戶照片（包含標籤）
- ✅ 分頁功能
- ✅ 照片刪除及關聯清理
- ✅ 文件驗證
- ✅ R2 配置測試
- ✅ 錯誤處理

### Photo API 測試 (`photo.api.test.ts`)

- ✅ POST /files/upload - 照片上傳
- ✅ GET /files/photos - 獲取用戶照片
- ✅ DELETE /files/photos/:photoId - 刪除照片
- ✅ POST /files/verify - 驗證文件
- ✅ GET /files/test-config - 測試配置
- ✅ 權限驗證
- ✅ 輸入驗證
- ✅ 錯誤處理

### 整合測試 (`integration.test.ts`)

- ✅ 完整的照片上傳和標籤工作流程
- ✅ 照片刪除時的標籤清理
- ✅ 多用戶場景
- ✅ 標籤統計和熱門度計算
- ✅ 複雜的標籤搜索場景
- ✅ 跨模組功能協作

## 測試數據

測試使用獨立的測試數據庫 (`test.db`)，包含：

### 測試用戶

- `test_user_1`: 主要測試用戶
- `test_user_2`: 次要測試用戶

### 測試標籤

- `sporty`: 運動風 🏃‍♀️
- `streetwear`: 街頭潮流 🛹
- `vintage`: 復古風 📻

### 測試照片

- 每個用戶有多張測試照片
- 包含不同格式和大小

## Mock 服務

測試中 Mock 了以下外部服務：

### R2 存儲服務

- `getR2Client()`: 返回模擬的 S3 客戶端
- `getPublicObjectUrl()`: 返回模擬的公共 URL
- `getPresignedGetUrl()`: 返回模擬的簽名 URL

### 認證服務

- `mockAuthUser()`: 模擬認證用戶
- 支持不同用戶身份的測試

## 測試最佳實踐

### 1. 測試隔離

每個測試都會：

- 清理測試數據
- 重新設置測試數據
- 使用獨立的數據庫實例

### 2. Mock 策略

- 外部服務（R2、認證）使用 Mock
- 數據庫操作使用真實的測試數據庫
- 保持測試的可預測性和速度

### 3. 測試分層

- **單元測試**: 測試單個服務類的功能
- **API 測試**: 測試 HTTP 端點的行為
- **整合測試**: 測試多個模組的協作

### 4. 錯誤場景

每個測試文件都包含：

- 正常流程測試
- 邊界條件測試
- 錯誤處理測試
- 權限驗證測試

## 持續集成

測試設計為可以在 CI/CD 環境中運行：

- 無需外部依賴
- 快速執行
- 清晰的錯誤報告
- 覆蓋率統計

## 故障排除

### 常見問題

1. **數據庫連接錯誤**

   ```bash
   # 確保 Prisma 客戶端已生成
   npx prisma generate
   ```

2. **測試數據庫問題**

   ```bash
   # 重新創建測試數據庫
   rm test.db
   npx prisma db push --schema prisma/schema.prisma
   ```

3. **Mock 服務問題**
   - 檢查 mock 模組路徑是否正確
   - 確保 mock 函數返回預期的數據結構

### 調試測試

```bash
# 運行單個測試並顯示詳細輸出
bun test tests/tag.service.test.ts --verbose

# 運行測試並保留測試數據庫
bun test --no-cleanup
```

## 貢獻指南

添加新測試時請遵循：

1. **命名規範**: 使用描述性的測試名稱
2. **測試結構**: 遵循 AAA 模式（Arrange, Act, Assert）
3. **覆蓋率**: 確保新功能有對應的測試
4. **文檔**: 更新相關的測試文檔

## 性能考慮

- 測試使用內存數據庫以提高速度
- Mock 外部服務調用
- 並行運行獨立的測試
- 適當的測試數據大小
