import * as THREE from 'three';

/**
 * Keeps the simulation and camera smooth while rendering into a deliberately
 * small drawing buffer. CSS scales that buffer with nearest-neighbour sampling,
 * producing stable, readable pixels without affecting aim or networking.
 */
export class PixelRenderPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.size = new THREE.Vector2();
  }

  resize(cssWidth, cssHeight) {
    const safeWidth = Math.max(1, Math.round(cssWidth));
    const safeHeight = Math.max(1, Math.round(cssHeight));
    const integerScale = Math.max(2, Math.round(safeHeight / 360));
    const internalWidth = Math.max(320, Math.round(safeWidth / integerScale));
    const internalHeight = Math.max(180, Math.round(safeHeight / integerScale));

    if (this.size.x === internalWidth && this.size.y === internalHeight) return;
    this.size.set(internalWidth, internalHeight);
    this.renderer.setSize(internalWidth, internalHeight, false);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {}
}
