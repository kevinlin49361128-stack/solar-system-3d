import { Vector3 } from 'three';
import type { BodyDescriptor } from './types';
import { dateFromJd } from './constants';

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
  description: string;
  /** Optional secondary value (e.g. elongation angle deg, distance AU). */
  value?: number;
  unit?: string;
}

const KIND_NAME: Record<EventKind, string> = {
  'opposition': '衝',
  'conjunction-sup': '上合',
  'conjunction-inf': '內合',
  'elongation-east': '東大距',
  'elongation-west': '西大距',
  'new-moon': '新月',
  'full-moon': '滿月',
  'solar-eclipse': '日食（可能）',
  'lunar-eclipse': '月食（可能）',
  'transit': '凌日',
  'occultation': '月掩星',
  'equinox': '分點',
  'solstice': '至點',
  'perihelion': '近日點',
  'aphelion': '遠日點',
  'planet-conjunction': '行星合',
};

export function eventKindLabel(k: EventKind): string {
  return KIND_NAME[k];
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
            events.push({
              kind: eastward ? 'elongation-east' : 'elongation-west',
              bodyId: pid,
              jd: jd - 1,
              date: dateFromJd(jd - 1),
              description: `${pid === 'mercury' ? '水星' : '金星'} ${eastward ? '東' : '西'}大距：行星位於太陽以${eastward ? '東' : '西'}側，與太陽地心角距達極大值 ${prev1.toFixed(1)}°，是${eastward ? '日落後昏空' : '日出前晨空'}的最佳觀測時機。`,
              value: prev1,
              unit: '°',
            });
          }
          // Inferior conjunction: local min of elongation < ~5° AND planet between earth and sun (radial close)
          if (prev1 < prev2 && prev1 < elong && prev1 < 10) {
            const planetDist = p.length();
            const earthDist = e.length();
            if (planetDist < earthDist) {
              const planetName = pid === 'mercury' ? '水星' : '金星';
              events.push({
                kind: 'conjunction-inf',
                bodyId: pid,
                jd: jd - 1,
                date: dateFromJd(jd - 1),
                description: `${planetName}下合：行星運行至太陽與地球之間（與地球同側），與太陽地心角距 ${prev1.toFixed(2)}°。`,
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
                  description: `${planetName}凌日：下合時行星黃緯接近 0°，從地球視線通過太陽圓盤前方（地心角距 ${prev1.toFixed(3)}° 小於太陽視半徑 0.27°）。水星凌日約每 7 年一次、金星凌日下次須等到 2117 年。`,
                  value: prev1, unit: '°',
                });
              }
            } else {
              events.push({
                kind: 'conjunction-sup',
                bodyId: pid,
                jd: jd - 1,
                date: dateFromJd(jd - 1),
                description: `${pid === 'mercury' ? '水星' : '金星'}上合：行星運行至太陽背後（與地球分居太陽兩側），太陽輻射遮蔽下無法觀測。`,
                value: prev1, unit: '°',
              });
            }
          }
        } else {
          // Outer planets: opposition = elong near 180°, conjunction = elong near 0°
          // Use d(elong)/dt sign change.
          if (prev1 > prev2 && prev1 > elong && prev1 > 170) {
            events.push({
              kind: 'opposition',
              bodyId: pid,
              jd: jd - 1,
              date: dateFromJd(jd - 1),
              description: `${getName(pid)}衝：地心觀測下行星與太陽黃經相差約 180°（角距 ${prev1.toFixed(1)}°）。日落時東升、日出時西沒，整夜可見；行星距地球最近，視亮度與視直徑全年最大。`,
              value: prev1, unit: '°',
            });
          }
          if (prev1 < prev2 && prev1 < elong && prev1 < 10) {
            events.push({
              kind: 'conjunction-sup',
              bodyId: pid,
              jd: jd - 1,
              date: dateFromJd(jd - 1),
              description: `${getName(pid)}合日：行星與太陽地心黃經幾乎相同（角距 ${prev1.toFixed(1)}°），位於太陽背後或近旁，被太陽輻射遮蔽無法觀測。`,
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
        if (prev1 < prev2 && prev1 < phase && prev1 < 5) {
          events.push({
            kind: 'new-moon',
            bodyId: 'moon',
            jd: jd - 0.25,
            date: dateFromJd(jd - 0.25),
            description: `新月：月球與太陽的地心黃經幾乎相同（角距 ${prev1.toFixed(2)}°），背陽面朝向地球，肉眼幾乎不可見。若黃緯也接近 0° 則可能發生日食。`,
            value: prev1, unit: '°',
          });
          if (prev1 < 1.5) {
            events.push({
              kind: 'solar-eclipse',
              bodyId: 'moon',
              jd: jd - 0.25,
              date: dateFromJd(jd - 0.25),
              description: `可能日食：新月時月球地心黃緯接近 0°（月日角距 ${prev1.toFixed(2)}°），月影錐可能掃過地球表面。實際食帶需精確軌道計算判定。`,
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
            description: `滿月：月球與太陽地心黃經相差約 180°（角距 ${prev1.toFixed(2)}°），向陽面整面朝向地球。若黃緯也接近 0° 則可能發生月食。`,
            value: prev1, unit: '°',
          });
          if (prev1 > 178.5) {
            events.push({
              kind: 'lunar-eclipse',
              bodyId: 'moon',
              jd: jd - 0.25,
              date: dateFromJd(jd - 0.25),
              description: `可能月食：滿月時月球地心黃緯接近 0°（月日角距 ${prev1.toFixed(2)}°），月球可能進入地球本影區，造成月偏食或月全食。`,
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
      const targets = [
        { deg: 0, kind: 'equinox' as const, desc: '春分：太陽地心黃經 0°，赤緯穿越赤道由南向北，全球晝夜近乎等長。' },
        { deg: 90, kind: 'solstice' as const, desc: '夏至：太陽地心黃經 90°，赤緯達到極大值 +23.44°；北半球白晝全年最長，南半球最短。' },
        { deg: 180, kind: 'equinox' as const, desc: '秋分：太陽地心黃經 180°，赤緯穿越赤道由北向南，全球晝夜近乎等長。' },
        { deg: 270, kind: 'solstice' as const, desc: '冬至：太陽地心黃經 270°，赤緯達到極小值 −23.44°；北半球白晝全年最短，南半球最長。' },
      ];
      for (const t of targets) {
        if (crossesAngle(prevLon, sunLon, t.deg)) {
          events.push({
            kind: t.kind,
            bodyId: 'earth',
            jd: jd - 0.5,
            date: dateFromJd(jd - 0.5),
            description: t.desc,
            value: t.deg, unit: '°',
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
      if (dists[i] < dists[i-1] && dists[i] < dists[i+1] && dists[i] < 0.985) {
        events.push({
          kind: 'perihelion',
          bodyId: 'earth',
          jd: jds[i],
          date: dateFromJd(jds[i]),
          description: `近日點：地球公轉軌道上距太陽最近處 (${dists[i].toFixed(4)} AU)，依克卜勒第二定律此時公轉速度最快。每年約 1 月 3-5 日通過。`,
          value: dists[i], unit: 'AU',
        });
      }
      if (dists[i] > dists[i-1] && dists[i] > dists[i+1] && dists[i] > 1.015) {
        events.push({
          kind: 'aphelion',
          bodyId: 'earth',
          jd: jds[i],
          date: dateFromJd(jds[i]),
          description: `遠日點：地球公轉軌道上距太陽最遠處 (${dists[i].toFixed(4)} AU)，依克卜勒第二定律此時公轉速度最慢。每年約 7 月 3-7 日通過。`,
          value: dists[i], unit: 'AU',
        });
      }
    }
  }

  // ---- Moon occultations of bright zodiac stars ----
  if (moon && moon.propagator) {
    // Stars near the ecliptic (decl within ±~7°): can be occulted by moon
    const ZODIAC_STARS: Array<{id: string; name: string; raH: number; decDeg: number}> = [
      { id: 'aldebaran', name: '畢宿五 (Aldebaran)', raH: 4.5987,  decDeg: 16.5092 },
      { id: 'regulus',   name: '軒轅十四 (Regulus)', raH: 10.1395, decDeg: 11.9672 },
      { id: 'spica',     name: '角宿一 (Spica)',     raH: 13.4199, decDeg: -11.1614 },
      { id: 'antares',   name: '心宿二 (Antares)',   raH: 16.4901, decDeg: -26.4320 },
      { id: 'pollux',    name: '北河三 (Pollux)',    raH: 7.7553,  decDeg: 28.0262 },
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
          events.push({
            kind: 'occultation',
            bodyId: 'moon',
            jd: jd - 0.25,
            date: dateFromJd(jd - 0.25),
            description: `月掩 ${star.name}：月球視位置從該恆星前方通過（地心角距 ${prev1.toFixed(2)}°）。實際遮蔽時刻與觀測帶因地表觀測者位置不同而異（視差效應）。`,
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
        events.push({
          kind: 'planet-conjunction',
          bodyId: a,
          jd: jd - 1,
          date: dateFromJd(jd - 1),
          description: `${getName(a)} 與 ${getName(b)} 相合：兩行星地心黃經接近，視角度上相距 ${prev1.toFixed(2)}°（屬視覺現象，與行星實際距離無關）。`,
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

/** Helper: detect angular crossing through `target` between two consecutive measurements (in degrees). */
function crossesAngle(prev: number, curr: number, target: number): boolean {
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

function getName(id: string): string {
  switch (id) {
    case 'mercury': return '水星';
    case 'venus':   return '金星';
    case 'mars':    return '火星';
    case 'jupiter': return '木星';
    case 'saturn':  return '土星';
    case 'uranus':  return '天王星';
    case 'neptune': return '海王星';
    default: return id;
  }
}
