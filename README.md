# 太陽系模擬 / Solar System 3D

**可解釋的天文模擬器**。互動式 3D 太陽系 + 地表觀星雙視角，瀏覽器內運行；用 Three.js + TypeScript + Vite 建置，NASA JPL J2000 根數 + Meeus 月球 / 太陽位置 + Velocity Verlet / Yoshida 4 階 N-body。

**設計理念**：每個顯示的數字都該可以追溯到使用的模型與其精度範圍。專案內建「ⓘ 模型精度」表 + N-body 守恆診斷 + 多維可觀測性評分，讓用戶能驗證、教學、規劃觀測。

> **🌐 Live demo**: <https://solar-system-3d-kappa.vercel.app/>
> **🇹🇼 中文 · 🇺🇸 English · 🇯🇵 日本語**

## Screenshots

### 太陽系全景（heliocentric）
![太陽系全景：八大行星軌道、彗星、小行星帶與古柏帶](public/screenshots/heliocentric-overview.jpg)

### 地表觀測模式（observer）
站在地球任意點，看真實大氣染色的天空 + 今晚天象資訊板。
![觀測者視角：高雄黃昏天空、羅盤、行星方位與航海／天文昏曙時刻](public/screenshots/observer-mode.jpg)

### 互動 UI
左側面板控制鏡頭模式、尺度（真實／對數／示意）、參考系（日心／地心）、書籤與光學工具。
![太陽系視角搭配左側互動控制面板](public/screenshots/with-ui.jpg)

> 想看實際運作？[**開啟 live demo**](https://solar-system-3d-kappa.vercel.app/)。

> 截圖由 `npm run screenshots` 自動生成（puppeteer-core + 系統 Chrome），有更新時可重跑。

## 主要功能

- **太陽系視角**：8 大行星、月球與主要衛星、5 顆矮行星、5 顆名彗星、8 艘太空船軌跡、小行星帶 / 古柏帶粒子雲
- **觀測者視角**：站在地球任意 lat/lon 點，看 atmosphere-shader 染色的真實天空、AWS Open Terrain DEM 真地形、Esri 衛星影像貼圖、8400+ 顆 BSC 恆星、110 個 Messier 深空天體、IAU 88 星座連線與邊界
- **時間控制**：暫停 / 倒轉 / 速率 0.0001×–1 年/秒 / 跳到任意 datetime / 自動偵測未來 2 年的 13 種天文事件（會合、衝、食、凌、極點、近日點、二分二至…）
- **物理可切換**：解析 Kepler 兩體 ↔ N-body Velocity Verlet 整合，可長時間跑攝動
- **計算模式**：任選參考點，即時顯示其他天體的相對距離、視線速度、合角等
- **光學工具**：6 個預設（裸眼 / 7×50 / 10×50 雙筒 / 80mm + 25mm 目鏡 / 8" SCT + 25/10mm），含視場、放大倍率、極限星等與目鏡風格 vignette
- **多語**：繁中 / English / 日本語
- **行動裝置**：響應式 layout、漢堡選單、雙指 pinch-zoom FOV、`touch-action: none` 防止瀏覽器手勢搶輸入

## 跑起來

```bash
npm install
npm run dev          # 開發伺服器 (Vite, HMR)
npm run build        # production build
npm run preview      # 看 build 結果
npm run typecheck    # tsc --noEmit
npm run test         # vitest run（31 個物理單元測試）
npm run test:watch   # 邊改邊跑
```

需要：Node 18+、現代瀏覽器（WebGL2 + ES2022）。

## 架構（三層分離）

```
src/
├── physics/         # 純函數軌道力學，無 Three.js 依賴
│   ├── kepler.ts            // Newton-Raphson 解 E - e·sinE = M（含高 e 阻尼修正）
│   ├── keplerPropagator.ts  // J2000 根數 + 線性 dM/dt → 狀態向量
│   ├── nbody.ts             // Velocity Verlet 整合器，可替換 Kepler
│   ├── topocentric.ts       // GMST、ECEF→ECI→ecliptic、Bennett 折射、IAU 1976 歲差
│   ├── frame.ts             // 黃道 ↔ 場景座標
│   ├── eventScanner.ts      // 自動偵測會合、食、凌、近日點等
│   └── constants.ts         // AU、J2000 epoch、地球轉軸傾角等
├── data/            # 純資料，不引用渲染
│   ├── bodies.ts            // 8 大行星 + 太陽 J2000 根數（NASA JPL）
│   ├── moons.ts, dwarfs.ts, comets.ts, spacecraft.ts
│   ├── stars.ts             // 67 顆名星（Hipparcos）
│   ├── constellations.ts    // 88 IAU 星座連線
│   ├── events.ts            // 預設歷史 / 未來事件
│   └── belts.ts             // 小行星帶 / 古柏帶分布
├── scene/           # Three.js 渲染層，從 propagator 拿位置
│   ├── SolarSystem.ts       // 整合所有 layer
│   ├── BodyMesh.ts          // 球 + 紋理 + 自轉 + tilt + 標籤 sprite
│   ├── OrbitLine.ts         // 由根數重建橢圓軌道
│   ├── Belt.ts              // InstancedMesh 粒子雲
│   ├── StarMap.ts           // 67 名星 + 星座連線 + 名字 sprite
│   ├── RealStarfield.ts     // 8404 BSC 自訂 ShaderMaterial
│   ├── MessierLayer.ts      // 110 深空天體
│   ├── IAUBoundaries.ts     // d3-celestial GeoJSON 邊界
│   ├── Spacecraft.ts        // 8 艘探測船軌跡
│   ├── AtmosphereSky.ts     // Three Sky shader（含 up uniform 修正）
│   ├── LocalTerrain.ts      // 程序 fallback / AWS Terrarium DEM + Esri 衛星影像
│   ├── LocationPin.ts       // 地表觀測點標記
│   └── Sun.ts, Skybox.ts, CalcVectors.ts, textureConfig.ts
├── controls/
│   ├── CameraController.ts  // OrbitControls 包裝 + observer mode（含 multi-touch pinch-zoom FOV）
│   └── ScaleController.ts   // real / log / schematic 三尺度
├── time/SimulationClock.ts  // JD-based 時鐘
├── ui/              # DOM overlay
│   ├── LeftPanel.ts         // 主控制 + GPS / 地圖選點 / 觀測 / 光學
│   ├── TimeControls.ts, InfoPanel.ts, SkyPanel.ts
│   ├── CalcPanel.ts, EventsPanel.ts, SearchBar.ts, MapPicker.ts (Leaflet)
│   └── charts.ts            // 組成 / 溫度 inline 圖表
├── i18n/            // 三語切換
└── main.ts          // 進入點
```

### 擴充原則

- 物理層用 `OrbitPropagator` interface 抽象（`physics/types.ts`）。第一版是 Kepler，N-body 是同 interface 的另一個實作；場景層完全不知道差別。
- 資料層只是純物件，沒有渲染知識；要加新天體只動 `data/`。
- UI 跟場景層唯一接面是 `SolarSystem` 的公開 method，沒有共享可變狀態。

## 測試

```bash
npm run test
```

目前覆蓋：
- **`kepler.test.ts`**：solver 在 e=0..0.995 全 M 範圍收斂、Halley 級高 e 的回歸測試（防止之前的 Newton 噴飛 bug 復發）
- **`topocentric.test.ts`**：GMST 在 J2000 ≈ 280.46°、每日 +0.985° sidereal drift、observer frame 三軸正交、precession 100 年位移 1.0–1.6°、Bennett 折射對標準參考值
- **`frame.test.ts`**：黃道→場景軸映射、長度保留、不修改輸入

UI / 整合測試還沒做（成本較高，物理回歸測試已經是 high-bug-density 區域的覆蓋）。

## 已知限制

- 觀測者所見的本地地形只有觀測點周圍 ~45km 半徑（25 個 zoom-12 tile），更遠處消失成黑底
- 行動裝置陀螺儀 AR 模式已實作但未在多支實機上完整驗證（iOS Safari `webkitCompassHeading` + Android `deviceorientationabsolute` 雙路徑均有 fallback；磁偏角修正尚未加入，方向可能差 5–15°）
- 恆星沒有自行（proper motion）跟光行差修正——拉到 1900 或 2100 會錯位
- 大氣用 Preetham 1999，黃昏漸層比較死板
- N-body 只含太陽系內主要天體，彗星跟太空船不參與攝動

## 第三方資料來源 / 授權

| 用途 | 來源 | 授權 |
|------|------|------|
| 行星根數 | [NASA JPL Approximate Positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html) | Public domain |
| 名星 | Hipparcos / SIMBAD | Public domain |
| BSC 8404 顆 | Yale Bright Star Catalog | Public domain |
| Messier 深空 | NASA / IAU | Public domain |
| 88 星座邊界 | IAU 1930 / d3-celestial GeoJSON | MIT |
| 地形 DEM | [AWS Open Terrain (Terrarium)](https://github.com/tilezen/joerd) | Open data, attribution required |
| 衛星貼圖 | Esri World Imagery | **個人 / 開發用免費；公開部署需 ArcGIS Developer 帳號** |
| 地圖底圖 | OpenStreetMap via Leaflet | ODbL, © OpenStreetMap contributors |
| 行星紋理 | [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 |

如果要公開部署（不只私人用），務必看 [docs/future-mobile-gyroscope.md](docs/future-mobile-gyroscope.md) 旁的注意事項，特別是 Esri 與 OSM tile 服務的條款。

## 開源套件

- [Three.js](https://threejs.org) — MIT
- [Vite](https://vitejs.dev) — MIT
- [TypeScript](https://www.typescriptlang.org) — Apache-2.0
- [lil-gui](https://github.com/georgealways/lil-gui) — MIT
- [Leaflet](https://leafletjs.com) — BSD-2
- [Vitest](https://vitest.dev) — MIT

## License

- 程式碼：[MIT](LICENSE)
- 資料 / 文檔：[CC BY-SA 4.0](LICENSE-CONTENT.md)
- 第三方資料：依各來源授權，見上表

## 支持這個專案

這是免費、開源、無廣告的個人專案。如果它對你有幫助：

- ⭐ **Star** 這個 repo — 最直接的鼓勵
- ☕ [小額贊助](SUPPORT.md) — Buy Me a Coffee / GitHub Sponsors
- 🏫 [機構客製化](SUPPORT.md#-教育機構--客製化) — 天文館 / 學校 / 科教中心專屬版本
- 📧 寫信告訴我你怎麼用它（特別是教育用途）

詳見 [SUPPORT.md](SUPPORT.md)。

---

_Made with ☕ in Taiwan · 開源永續，由社群支持_
