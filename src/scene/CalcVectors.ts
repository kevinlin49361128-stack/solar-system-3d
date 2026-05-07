import {
  ArrowHelper,
  Color,
  Group,
  Vector3,
} from 'three';
import type { SolarSystem } from './SolarSystem';

const TARGET_IDS = [
  'sun', 'mercury', 'venus', 'earth', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune',
  'pluto', 'ceres', 'eris', 'makemake', 'haumea',
];

const ARROW_COLOR = 0x7fd07f;

/**
 * Renders 3D arrows from a reference body to every other body in the
 * heliocentric set, so the user can see relative geometry in the scene.
 */
export class CalcVectors {
  readonly group = new Group();
  private arrows = new Map<string, ArrowHelper>();
  private referenceId: string | null = null;

  constructor(private solarSystem: SolarSystem) {
    this.solarSystem.scene.add(this.group);
    this.group.visible = false;
  }

  setReference(id: string | null): void {
    this.referenceId = id;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  isVisible(): boolean { return this.group.visible; }

  update(): void {
    if (!this.group.visible || !this.referenceId) return;
    const refPos = this.solarSystem.getWorldPosition(this.referenceId, _refPos);
    if (!refPos) return;

    for (const id of TARGET_IDS) {
      if (id === this.referenceId) {
        const arr = this.arrows.get(id);
        if (arr) arr.visible = false;
        continue;
      }
      const targetPos = this.solarSystem.getWorldPosition(id, _targetPos);
      if (!targetPos) continue;
      const dir = _dir.copy(targetPos).sub(refPos);
      const len = dir.length();
      if (len === 0) continue;
      dir.normalize();

      let arrow = this.arrows.get(id);
      if (!arrow) {
        arrow = new ArrowHelper(dir, refPos, len, ARROW_COLOR, len * 0.04, len * 0.02);
        // Slight per-target tint so multiple arrows can be told apart.
        const hue = (Array.from(this.arrows.keys()).length * 47) % 360;
        const c = new Color(`hsl(${hue}, 70%, 60%)`);
        arrow.setColor(c);
        this.arrows.set(id, arrow);
        this.group.add(arrow);
      } else {
        arrow.position.copy(refPos);
        arrow.setDirection(dir);
        arrow.setLength(len, len * 0.04, len * 0.02);
        arrow.visible = true;
      }
    }
  }

  dispose(): void {
    for (const arr of this.arrows.values()) {
      this.group.remove(arr);
      arr.dispose?.();
    }
    this.arrows.clear();
    this.solarSystem.scene.remove(this.group);
  }
}

const _refPos = new Vector3();
const _targetPos = new Vector3();
const _dir = new Vector3();
