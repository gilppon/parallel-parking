import Phaser from 'phaser';
import { ParkingScene } from './ParkingScene';
import { WORLD_H, WORLD_W } from './types';

/**
 * Boots Phaser 3 with the Matter.js physics plugin.
 * Matter's own runner is disabled (`autoUpdate: false`); the scene advances the
 * world with a deterministic 60 Hz fixed timestep so the car model behaves
 * identically on 60 / 120 / 144 Hz displays.
 */
export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WORLD_W,
    height: WORLD_H,
    backgroundColor: '#0b0d12',
    scale: { mode: Phaser.Scale.NONE },
    render: { antialias: true, powerPreference: 'high-performance' },
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: 0 },
        autoUpdate: false,
        debug: false,
        enableSleeping: false,
        positionIterations: 8,
        velocityIterations: 6,
      },
    },
    input: { keyboard: true, mouse: false, touch: false, gamepad: false },
    disableContextMenu: true,
    scene: [ParkingScene],
  });
}
