import { Vector3 } from 'three';
import type { BodyDescriptor } from './types';
import { dateFromJd } from './constants';
import { t, type LangText } from '../i18n';

/**
 * 自動偵測天文事件（沖、合、極大距、新月、滿月、可能日/月食）。
 *
 * 演算法：每天取樣相關角度／距離，找區域極值（local minima/maxima）。
 * 對於日食/月食，採用粗略幾何判據（無精確陰影錐）— 標記為「可能」。
 */

export type EventKind =
  | 'opposition'         // 衝
  | 'conjunction-sup'    // 上合
  | 'conjunction-inf'    // 內合
  | 'elongation-east'    // 東大距
  | 'elongation-west'    // 西大距
  | 'new-moon'           // 朔（新月）
  | 'full-moon'          // 望（滿月）
  | 'solar-eclipse'      // 日食（可能）
  | 'lunar-eclipse'      // 月食（可能）
  | 'transit'            // 凌日（水星/金星）
  | 'occultation'        // 月掩星
  | 'equinox'            // 春分/秋分
  | 'solstice'           // 夏至/冬至
  | 'perihelion'         // 近日點
  | 'aphelion'           // 遠日點
  | 'planet-conjunction'; // 行星合（兩行星接近）

export interface DetectedEvent {
  kind: EventKind;
  bodyId: string;        // 主要相關天體（行星 / 月球）
  jd: number;
  date: Date;
  /** Pre-rendered, multi-language description. Consumers should call
   * `langPick(description)` (from the i18n module) at render time. */
  description: LangText;
  /** Optional secondary value (e.g. elongation angle deg, distance AU). */
  value?: number;
  unit?: string;
}

export function eventKindLabel(k: EventKind): string {
  return t(`event.kind.${k}`);
}

/** Per-language body name for the small set of bodies that show up in event
 * descriptions. Authored inline rather than reaching into the registry to
 * keep this module decoupled from the scene layer. */
const BODY_NAMES: Record<string, Record<'zh-Hant' | 'en' | 'ja', string>> = {
  mercury: { 'zh-Hant': '水星',   en: 'Mercury', ja: '水星' },
  venus:   { 'zh-Hant': '金星',   en: 'Venus',   ja: '金星' },
  mars:    { 'zh-Hant': '火星',   en: 'Mars',    ja: '火星' },
  jupiter: { 'zh-Hant': '木星',   en: 'Jupiter', ja: '木星' },
  saturn:  { 'zh-Hant': '土星',   en: 'Saturn',  ja: '土星' },
  uranus:  { 'zh-Hant': '天王星', en: 'Uranus',  ja: '天王星' },
  neptune: { 'zh-Hant': '海王星', en: 'Neptune', ja: '海王星' },
};

function nameByLang(id: string, lang: 'zh-Hant' | 'en' | 'ja'): string {
  return BODY_NAMES[id]?.[lang] ?? id;
}

/** Build a LangText with per-language descriptions already substituted. */
function makeDesc(zh: string, en: string, ja: string): LangText {
  return { 'zh-Hant': zh, en, ja };
}

interface ScanContext {
  bodies: Map<string, BodyDescriptor>;
  earthPos(jd: number): Vector3;
  bodyHelio(id: string, jd: number): Vector3;
}

function buildContext(bodies: BodyDescriptor[]): ScanContext {
  const map = new Map<string, BodyDescriptor>();
  for (const b of bodies) map.set(b.id, b);
  return {
    bodies: map,
    earthPos(jd: number): Vector3 {
      const e = map.get('earth')!;
      return e.propagator!.stateAt(jd).position.clone();
    },
    bodyHelio(id: string, jd: number): Vector3 {
      const b = map.get(id);
      if (!b || !b.propagator) return new Vector3();
      return b.propagator.stateAt(jd).position.clone();
    },
  };
}

/** Angle (degrees) between two directions from Earth: planet vs sun. */
function elongationDeg(planetHelio: Vector3, earthHelio: Vector3): number {
  // Sun direction from Earth = -earthHelio
  // Planet direction from Earth = planetHelio - earthHelio
  const sunDir = earthHelio.clone().multiplyScalar(-1).normalize();
  const planetDir = planetHelio.clone().sub(earthHelio).normalize();
  const cos = Math.max(-1, Math.min(1, sunDir.dot(planetDir)));
  return Math.acos(cos) * 180 / Math.PI;
}

/** For Moon (relative to Earth): phase angle (0 = new, 180 = full). */
function moonPhaseDeg(moonGeo: Vector3, earthHelio: Vector3): number {
  // Moon's heliocentric pos = earth + moon-geocentric
  // Sun direction from Moon = -(earth + moonGeo); from Earth's view of Moon:
  // angle Sun-Moon-Earth at the moon vertex.
  // Simpler: phase = 180° - elongation (Moon-Sun ang at Earth)
  const sunDir = earthHelio.clone().multiplyScalar(-1).normalize();
  const moonDir = moonGeo.clone().normalize();
  const cos = Math.max(-1, Math.min(1, sunDir.dot(moonDir)));
  const elong = Math.acos(cos) * 180 / Math.PI;
  return elong; // 0 = sun and moon coincide (new), 180 = opposite (full)
}

/**
 * Scan a JD range, finding events with daily granularity.
 * `bodies` should include sun, earth, moon, and planets with valid propagators.
 */
export function scanEvents(
  bodies: BodyDescriptor[],
  startJd: number,
  endJd: number,
): DetectedEvent[] {
  const ctx = buildContext(bodies);
  const events: DetectedEvent[] = [];

  // ---- Planet events (Mercury, Venus, Mars, Jupiter, Saturn) ----
  const planetIds = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  for (const pid of planetIds) {
    const isInner = pid === 'mercury' || pid === 'venus';
    let prev2 = 0, prev1 = 0;
    let prev2Lon = 0, prev1Lon = 0; // for elongation east/west detection (signed)

    for (let jd = startJd; jd <= endJd; jd += 1) {
      const e = ctx.earthPos(jd);
      const p = ctx.bodyHelio(pid, jd);
      const elong = elongationDeg(p, e);

      // Sign: cross product Earth→Sun × Earth→Planet z component (ecliptic frame).
      // Positive z = planet east of sun.
      const sunDir = e.clone().multiplyScalar(-1).normalize();
      const planetDir = p.clone().sub(e).normalize();
      const crossZ = sunDir.x * planetDir.y - sunDir.y * planetDir.x;
      const signedElong = crossZ >= 0 ? elong : -elong;

      if (jd > startJd + 1) {
        // Local maximum of elong (turning point) for inner planets = greatest elongation
        if (isInner) {
          if (prev1 > prev2 && prev1 > elong && prev1 > 10) {
            // Greatest elongation
            const eastward = prev1Lon > 0;
            const valStr = prev1.toFixed(1);
            const zh = `${nameByLang(pid, 'zh-Hant')} ${eastward ? '東' : '西'}大距：行星位於太陽以${eastward ? '東' : '西'}側，與太陽地心角距達極大值 ${valStr}°，是${eastward ? '日落後昏空' : '日出前晨空'}的最佳觀測時機。`;
            const en = `Greatest ${eastward ? 'eastern' : 'western'} elongation of ${nameByLang(pid, 'en')}: planet sits ${eastward ? 'east' : 'west'} of the sun at maximum geocentric separation ${valStr}° — best ${eastward ? 'evening' : 'morning'} apparition.`;
            const ja = `${nameByLang(pid, 'ja')}の${eastward ? '東方' : '西方'}最大離角：太陽の${eastward ? '東' : '西'}側に位置し、地心離角が最大 ${valStr}° に達します。${eastward ? '日没後の宵空' : '日出前の明空'}での観測適期。`;
            events.push({
              kind: eastward ? 'elongation-east' : 'elongation-west',
              bodyId: pid,
              jd: jd - 1,
              date: dateFromJd(jd - 1),
              description: makeDesc(zh, en, ja),
              value: prev1,
              unit: '°',
            });
          }
          // Inferior conjunction: local min of elongation < ~5° AND planet between earth and sun (radial close)
          if (prev1 < prev2 && prev1 < elong && prev1 < 10) {
            const planetDist = p.length();
            const earthDist = e.length();
            const v2 = prev1.toFixed(2);
            const v3 = prev1.toFixed(3);
            if (planetDist < earthDist) {
              events.push({
                kind: 'conjunction-inf',
                bodyId: pid,
                jd: jd - 1,
                date: dateFromJd(jd - 1),
                description: makeDesc(
                  `${nameByLang(pid, 'zh-Hant')}下合：行星運行至太陽與地球之間（與地球同側），與太陽地心角距 ${v2}°。`,
                  `Inferior conjunction of ${nameByLang(pid, 'en')}: planet passes between the sun and Earth (same side as Earth) with geocentric separation ${v2}°.`,
                  `${nameByLang(pid, 'ja')}の内合：太陽と地球の間（地球と同じ側）を通過し、地心離角は ${v2}° です。`,
                ),
                value: prev1, unit: '°',
              });
              // Transit: planet's silhouette overlaps the sun's disk
              // Sun's apparent radius from Earth ≈ 0.27°
              if (prev1 < 0.27) {
                events.push({
                  kind: 'transit',
                  bodyId: pid,
                  jd: jd - 1,
                  date: dateFromJd(jd - 1),
                  description: makeDesc(
                    `${nameByLang(pid, 'zh-Hant')}凌日：下合時行星黃緯接近 0°，從地球視線通過太陽圓盤前方（地心角距 ${v3}° 小於太陽視半徑 0.27°）。水星凌日約每 7 年一次、金星凌日下次須等到 2117 年。`,
                    `${nameByLang(pid, 'en')} transit: at inferior conjunction the planet's ecliptic latitude is near 0°, so it crosses the solar disk as seen from Earth (geocentric separation ${v3}° < sun's apparent radius 0.27°). Mercury transits occur ≈ every 7 years; the next Venus transit is in 2117.`,
                    `${nameByLang(pid, 'ja')}の太陽面通過：内合時の黄緯がほぼ 0° で、地球から見て太陽面を横切ります（地心離角 ${v3}° は太陽視半径 0.27° 未満）。水星では約 7 年ごと、金星では次回は 2117 年。`,
                  ),
                  value: prev1, unit: '°',
                });
              }
            } else {
              events.push({
                kind: 'conjunction-sup',
                bodyId: pid,
                jd: jd - 1,
                date: dateFromJd(jd - 1),
                description: makeDesc(
                  `${nameByLang(pid, 'zh-Hant')}上合：行星運行至太陽背後（與地球分居太陽兩側），太陽輻射遮蔽下無法觀測。`,
                  `Superior conjunction of ${nameByLang(pid, 'en')}: planet passes behind the sun (opposite side from Earth) and is unobservable due to solar glare.`,
                  `${nameByLang(pid, 'ja')}の外合：太陽の向こう側（地球と反対側）に位置し、太陽光に遮られて観測不可。`,
                ),
                value: prev1, unit: '°',
              });
            }
          }
        } else {
          // Outer planets: opposition = elong near 180°, conjunction = elong near 0°
          // Use d(elong)/dt sign change.
          const v1 = prev1.toFixed(1);
          if (prev1 > prev2 && prev1 > elong && prev1 > 170) {
            events.push({
              kind: 'opposition',
              bodyId: pid,
              jd: jd - 1,
              date: dateFromJd(jd - 1),
              description: makeDesc(
                `${nameByLang(pid, 'zh-Hant')}衝：地心觀測下行星與太陽黃經相差約 180°（角距 ${v1}°）。日落時東升、日出時西沒，整夜可見；行星距地球最近，視亮度與視直徑全年最大。`,
                `Opposition of ${nameByLang(pid, 'en')}: as seen from Earth the planet sits ~180° from the sun in ecliptic longitude (separation ${v1}°). It rises at sunset, sets at sunrise, is visible all night, is closest to Earth, and reaches its peak brightness and apparent size for the year.`,
                `${nameByLang(pid, 'ja')}の衝：地心から見て黄経で太陽からほぼ 180°（離角 ${v1}°）。日没に東から昇り日出に西へ沈み、一晩中観測可能。地球に最接近し、年間で最も明るく大きく見えます。`,
              ),
              value: prev1, unit: '°',
            });
          }
          if (prev1 < prev2 && prev1 < elong && prev1 < 10) {
            events.push({
              kind: 'conjunction-sup',
              bodyId: pid,
              jd: jd - 1,
              date: dateFromJd(jd - 1),
              description: makeDesc(
                `${nameByLang(pid, 'zh-Hant')}合日：行星與太陽地心黃經幾乎相同（角距 ${v1}°），位於太陽背後或近旁，被太陽輻射遮蔽無法觀測。`,
                `Conjunction of ${nameByLang(pid, 'en')} with the sun: planet's geocentric ecliptic longitude nearly matches the sun's (separation ${v1}°), placing it behind or beside the sun and obscured by solar glare.`,
                `${nameByLang(pid, 'ja')}の合：地心黄経が太陽とほぼ一致（離角 ${v1}°）し、太陽の背後または近傍にあって観測不可。`,
              ),
              value: prev1, unit: '°',
            });
          }
        }
      }
      prev2 = prev1;
      prev1 = elong;
      prev2Lon = prev1Lon;
      prev1Lon = signedElong;
      void prev2Lon;
    }
  }

  // ---- Moon phases ----
  // Moon is in `bodies` as parentId='earth'; its propagator returns geo position.
  const moon = ctx.bodies.get('moon');
  if (moon && moon.propagator) {
    let prev2 = 0, prev1 = 0;
    for (let jd = startJd; jd <= endJd; jd += 0.25) {
      const e = ctx.earthPos(jd);
      const moonGeo = moon.propagator.stateAt(jd).position;
      const phase = moonPhaseDeg(moonGeo, e);

      if (jd > startJd + 0.25) {
        const v2 = prev1.toFixed(2);
        if (prev1 < prev2 && prev1 < phase && prev1 < 5) {
          events.push({
            kind: 'new-moon',
            bodyId: 'moon',
            jd: jd - 0.25,
            date: dateFromJd(jd - 0.25),
            description: makeDesc(
              `新月：月球與太陽的地心黃經幾乎相同（角距 ${v2}°），背陽面朝向地球，肉眼幾乎不可見。若黃緯也接近 0° 則可能發生日食。`,
              `New moon: the moon's geocentric ecliptic longitude nearly matches the sun's (separation ${v2}°), so its unlit hemisphere faces Earth and it's effectively invisible. A solar eclipse can occur if the latitude is also near 0°.`,
              `新月：月の地心黄経が太陽とほぼ一致（離角 ${v2}°）し、暗い面が地球を向くため肉眼ではほぼ見えません。黄緯も 0° に近ければ日食が起こり得ます。`,
            ),
            value: prev1, unit: '°',
          });
          if (prev1 < 1.5) {
            events.push({
              kind: 'solar-eclipse',
              bodyId: 'moon',
              jd: jd - 0.25,
              date: dateFromJd(jd - 0.25),
              description: makeDesc(
                `可能日食：新月時月球地心黃緯接近 0°（月日角距 ${v2}°），月影錐可能掃過地球表面。實際食帶需精確軌道計算判定。`,
                `Possible solar eclipse: at new moon the moon's geocentric ecliptic latitude is near 0° (sun-moon separation ${v2}°), so the lunar shadow cone may sweep across Earth. Confirm the actual path with precise orbit computation.`,
                `日食の可能性：新月時の地心黄緯が 0° に近く（月日離角 ${v2}°）、月影錐が地球面を掃く可能性があります。実際の食帯は精密な軌道計算で判定が必要です。`,
              ),
              value: prev1, unit: '°',
            });
          }
        }
        if (prev1 > prev2 && prev1 > phase && prev1 > 175) {
          events.push({
            kind: 'full-moon',
            bodyId: 'moon',
            jd: jd - 0.25,
            date: dateFromJd(jd - 0.25),
            description: makeDesc(
              `滿月：月球與太陽地心黃經相差約 180°（角距 ${v2}°），向陽面整面朝向地球。若黃緯也接近 0° 則可能發生月食。`,
              `Full moon: the moon sits ~180° from the sun in geocentric ecliptic longitude (separation ${v2}°), so its lit hemisphere faces Earth fully. A lunar eclipse can occur if the latitude is also near 0°.`,
              `満月：地心黄経で太陽とほぼ 180°（離角 ${v2}°）離れ、明るい面全体が地球を向きます。黄緯も 0° に近ければ月食が起こり得ます。`,
            ),
            value: prev1, unit: '°',
          });
          if (prev1 > 178.5) {
            events.push({
              kind: 'lunar-eclipse',
              bodyId: 'moon',
              jd: jd - 0.25,
              date: dateFromJd(jd - 0.25),
              description: makeDesc(
                `可能月食：滿月時月球地心黃緯接近 0°（月日角距 ${v2}°），月球可能進入地球本影區，造成月偏食或月全食。`,
                `Possible lunar eclipse: at full moon the moon's geocentric ecliptic latitude is near 0° (sun-moon separation ${v2}°), so it may enter Earth's umbral shadow producing a partial or total lunar eclipse.`,
                `月食の可能性：満月時の地心黄緯が 0° に近く（月日離角 ${v2}°）、月が地球の本影に入って部分月食または皆既月食となる可能性があります。`,
              ),
              value: prev1, unit: '°',
            });
          }
        }
      }
      prev2 = prev1;
      prev1 = phase;
    }
  }

  // ---- Equinoxes / Solstices / Earth peri/aphelion ----
  // Earth heliocentric ecliptic longitude crossings: 0° vernal, 90° summer,
  // 180° autumn, 270° winter solstice.
  let prevLon = -1, prevDist = -1;
  for (let jd = startJd; jd <= endJd; jd += 1) {
    const e = ctx.earthPos(jd);
    // Earth's longitude as seen from Sun. Sun's ecliptic longitude as seen
    // from Earth is opposite (rev by 180°). For equinox/solstice we use the
    // sun's geocentric longitude (which is what astronomers reference).
    const sunLon = (Math.atan2(-e.y, -e.x) * 180 / Math.PI + 360) % 360;
    const dist = e.length();

    if (prevLon >= 0) {
      // Detect crossing of 0/90/180/270 in sun's geocentric longitude
      const targets: Array<{ deg: number; kind: 'equinox' | 'solstice'; desc: LangText }> = [
        {
          deg: 0,
          kind: 'equinox',
          desc: makeDesc(
            '春分：太陽地心黃經 0°，赤緯穿越赤道由南向北，全球晝夜近乎等長。',
            'Vernal equinox: sun reaches geocentric ecliptic longitude 0° and crosses the celestial equator south-to-north. Day and night are nearly equal worldwide.',
            '春分：太陽の地心黄経が 0°、赤緯が赤道を南から北へ横切り、世界中で昼夜がほぼ等しくなります。',
          ),
        },
        {
          deg: 90,
          kind: 'solstice',
          desc: makeDesc(
            '夏至：太陽地心黃經 90°，赤緯達到極大值 +23.44°；北半球白晝全年最長，南半球最短。',
            'June solstice: sun reaches geocentric ecliptic longitude 90° and its declination peaks at +23.44°. Northern hemisphere has its longest day; southern its shortest.',
            '夏至：太陽の地心黄経が 90°、赤緯が +23.44° で最大に。北半球は一年で最も日が長く、南半球は最短。',
          ),
        },
        {
          deg: 180,
          kind: 'equinox',
          desc: makeDesc(
            '秋分：太陽地心黃經 180°，赤緯穿越赤道由北向南，全球晝夜近乎等長。',
            'Autumnal equinox: sun reaches geocentric ecliptic longitude 180° and crosses the celestial equator north-to-south. Day and night are nearly equal worldwide.',
            '秋分：太陽の地心黄経が 180°、赤緯が赤道を北から南へ横切り、世界中で昼夜がほぼ等しくなります。',
          ),
        },
        {
          deg: 270,
          kind: 'solstice',
          desc: makeDesc(
            '冬至：太陽地心黃經 270°，赤緯達到極小值 −23.44°；北半球白晝全年最短，南半球最長。',
            'December solstice: sun reaches geocentric ecliptic longitude 270° and its declination bottoms out at −23.44°. Northern hemisphere has its shortest day; southern its longest.',
            '冬至：太陽の地心黄経が 270°、赤緯が −23.44° で最小に。北半球は一年で最も日が短く、南半球は最長。',
          ),
        },
      ];
      for (const tg of targets) {
        if (crossesAngle(prevLon, sunLon, tg.deg)) {
          events.push({
            kind: tg.kind,
            bodyId: 'earth',
            jd: jd - 0.5,
            date: dateFromJd(jd - 0.5),
            description: tg.desc,
            value: tg.deg, unit: '°',
          });
        }
      }
    }
    if (prevDist > 0) {
      // Detect local extrema of Earth-Sun distance
      // Use 3-day window via prevDist & next sample (look-ahead): simple mark min/max by sign change of derivative
      // Defer comparison via a small ring buffer:
      // For simplicity, store last 3 days and detect turning point.
    }
    prevLon = sunLon;
    prevDist = dist;
    void prevDist;
  }

  // Earth perihelion/aphelion using a simple 3-day local-extremum scan
  {
    const dists: number[] = [];
    const jds: number[] = [];
    for (let jd = startJd; jd <= endJd; jd += 1) {
      dists.push(ctx.earthPos(jd).length());
      jds.push(jd);
    }
    for (let i = 1; i < dists.length - 1; i++) {
      const distStr = dists[i].toFixed(4);
      if (dists[i] < dists[i-1] && dists[i] < dists[i+1] && dists[i] < 0.985) {
        events.push({
          kind: 'perihelion',
          bodyId: 'earth',
          jd: jds[i],
          date: dateFromJd(jds[i]),
          description: makeDesc(
            `近日點：地球公轉軌道上距太陽最近處 (${distStr} AU)，依克卜勒第二定律此時公轉速度最快。每年約 1 月 3-5 日通過。`,
            `Perihelion: closest point on Earth's orbit to the sun (${distStr} AU). Per Kepler's 2nd law Earth orbits fastest here. It occurs around 3–5 January each year.`,
            `近日点：地球公転軌道で太陽に最も近い地点（${distStr} AU）。ケプラーの第2法則により公転速度は最大、毎年1月3〜5日ごろ通過。`,
          ),
          value: dists[i], unit: 'AU',
        });
      }
      if (dists[i] > dists[i-1] && dists[i] > dists[i+1] && dists[i] > 1.015) {
        events.push({
          kind: 'aphelion',
          bodyId: 'earth',
          jd: jds[i],
          date: dateFromJd(jds[i]),
          description: makeDesc(
            `遠日點：地球公轉軌道上距太陽最遠處 (${distStr} AU)，依克卜勒第二定律此時公轉速度最慢。每年約 7 月 3-7 日通過。`,
            `Aphelion: farthest point on Earth's orbit from the sun (${distStr} AU). Per Kepler's 2nd law Earth orbits slowest here. It occurs around 3–7 July each year.`,
            `遠日点：地球公転軌道で太陽から最も遠い地点（${distStr} AU）。ケプラーの第2法則により公転速度は最小、毎年7月3〜7日ごろ通過。`,
          ),
          value: dists[i], unit: 'AU',
        });
      }
    }
  }

  // ---- Moon occultations of bright zodiac stars ----
  if (moon && moon.propagator) {
    // Stars near the ecliptic (decl within ±~7°): can be occulted by moon
    const ZODIAC_STARS: Array<{id: string; nameZh: string; nameEn: string; nameJa: string; raH: number; decDeg: number}> = [
      { id: 'aldebaran', nameZh: '畢宿五 (Aldebaran)', nameEn: 'Aldebaran', nameJa: 'アルデバラン (畢宿五)', raH: 4.5987,  decDeg: 16.5092 },
      { id: 'regulus',   nameZh: '軒轅十四 (Regulus)', nameEn: 'Regulus',   nameJa: 'レグルス (軒轅十四)',   raH: 10.1395, decDeg: 11.9672 },
      { id: 'spica',     nameZh: '角宿一 (Spica)',     nameEn: 'Spica',     nameJa: 'スピカ (角宿一)',       raH: 13.4199, decDeg: -11.1614 },
      { id: 'antares',   nameZh: '心宿二 (Antares)',   nameEn: 'Antares',   nameJa: 'アンタレス (心宿二)',   raH: 16.4901, decDeg: -26.4320 },
      { id: 'pollux',    nameZh: '北河三 (Pollux)',    nameEn: 'Pollux',    nameJa: 'ポルックス (北河三)',   raH: 7.7553,  decDeg: 28.0262 },
    ];
    // Moon's apparent radius ≈ 16'
    const occulationThresh = 0.3; // deg, generous (close approach)
    for (const star of ZODIAC_STARS) {
      // Star direction in ecliptic
      const starDirEcl = raDecToEclipticDir(star.raH, star.decDeg);
      let prev2 = 999, prev1 = 999;
      for (let jd = startJd; jd <= endJd; jd += 0.25) {
        const moonGeo = moon.propagator.stateAt(jd).position;
        const moonDir = moonGeo.clone().normalize();
        const cos = Math.max(-1, Math.min(1, moonDir.dot(starDirEcl)));
        const ang = Math.acos(cos) * 180 / Math.PI;
        if (jd > startJd + 0.25 && prev1 < prev2 && prev1 < ang && prev1 < occulationThresh) {
          const v2 = prev1.toFixed(2);
          events.push({
            kind: 'occultation',
            bodyId: 'moon',
            jd: jd - 0.25,
            date: dateFromJd(jd - 0.25),
            description: makeDesc(
              `月掩 ${star.nameZh}：月球視位置從該恆星前方通過（地心角距 ${v2}°）。實際遮蔽時刻與觀測帶因地表觀測者位置不同而異（視差效應）。`,
              `Lunar occultation of ${star.nameEn}: the moon's apparent position passes in front of the star (geocentric separation ${v2}°). Exact contact times and the visibility band depend on the observer's location due to parallax.`,
              `月による${star.nameJa}の掩蔽：月の視位置がこの恒星の前を通過（地心離角 ${v2}°）。実際の接触時刻と可視帯は視差により観測地によって異なります。`,
            ),
            value: prev1, unit: '°',
          });
        }
        prev2 = prev1;
        prev1 = ang;
      }
    }
  }

  // ---- Planet-planet conjunctions (close approach as seen from Earth) ----
  const conjPairs: Array<[string, string]> = [
    ['venus', 'jupiter'], ['venus', 'mars'], ['venus', 'saturn'],
    ['mars', 'jupiter'], ['jupiter', 'saturn'], ['mars', 'saturn'],
  ];
  for (const [a, b] of conjPairs) {
    let prev2 = 999, prev1 = 999;
    for (let jd = startJd; jd <= endJd; jd += 1) {
      const e = ctx.earthPos(jd);
      const pa = ctx.bodyHelio(a, jd);
      const pb = ctx.bodyHelio(b, jd);
      const dirA = pa.clone().sub(e).normalize();
      const dirB = pb.clone().sub(e).normalize();
      const cos = Math.max(-1, Math.min(1, dirA.dot(dirB)));
      const ang = Math.acos(cos) * 180 / Math.PI;
      if (jd > startJd + 1 && prev1 < prev2 && prev1 < ang && prev1 < 5) {
        const v2 = prev1.toFixed(2);
        events.push({
          kind: 'planet-conjunction',
          bodyId: a,
          jd: jd - 1,
          date: dateFromJd(jd - 1),
          description: makeDesc(
            `${nameByLang(a, 'zh-Hant')} 與 ${nameByLang(b, 'zh-Hant')} 相合：兩行星地心黃經接近，視角度上相距 ${v2}°（屬視覺現象，與行星實際距離無關）。`,
            `Conjunction of ${nameByLang(a, 'en')} and ${nameByLang(b, 'en')}: the two planets' geocentric ecliptic longitudes nearly match, giving an apparent separation of ${v2}°. This is purely a line-of-sight effect and unrelated to their actual distance.`,
            `${nameByLang(a, 'ja')} と ${nameByLang(b, 'ja')} の合：両惑星の地心黄経が接近し、視角で ${v2}° 離れて見えます（視覚的現象で、実距離とは無関係）。`,
          ),
          value: prev1, unit: '°',
        });
      }
      prev2 = prev1;
      prev1 = ang;
    }
  }

  events.sort((a, b) => a.jd - b.jd);
  return events;
}

/**
 * Helper: detect angular crossing through `target` between two consecutive
 * measurements (in degrees). Exported for unit testing — it is the single
 * gate behind every equinox/solstice detection, so a regression here would
 * silently drop those markers.
 */
export function crossesAngle(prev: number, curr: number, target: number): boolean {
  // Normalise: signed shortest difference from target
  const dp = ((prev - target + 540) % 360) - 180;
  const dc = ((curr - target + 540) % 360) - 180;
  // Crossing if signs differ AND total swing is small (i.e., not wrap-around)
  return dp * dc < 0 && Math.abs(dp - dc) < 30;
}

/** RA/Dec → ecliptic-J2000 unit vector (no Vector3 dependency at top of file scope). */
function raDecToEclipticDir(raH: number, decDeg: number): Vector3 {
  const ra = raH * Math.PI / 12;
  const dec = decDeg * Math.PI / 180;
  const xEq = Math.cos(dec) * Math.cos(ra);
  const yEq = Math.cos(dec) * Math.sin(ra);
  const zEq = Math.sin(dec);
  const eps = 23.4393 * Math.PI / 180;
  const cE = Math.cos(eps), sE = Math.sin(eps);
  return new Vector3(xEq, yEq * cE + zEq * sE, -yEq * sE + zEq * cE);
}

