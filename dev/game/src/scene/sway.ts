/**
 * Покачивание культур ветром. Один uniform uTime на всю сцену; смещение
 * вершин по синусу от времени и мировой позиции, амплитуда растёт с высотой
 * вершины. Референс амплитуды/периода — animate_sway из скрипта 04.
 */
import * as THREE from 'three'

export const swayUniforms = { uTime: { value: 0 } }

const CROP_MATERIALS = new Set([
  'CarrotBody',
  'CarrotTop',
  'Greens',
  'TomatoLeaf',
  'TomatoFruit',
])

export function isCropMaterial(name: string): boolean {
  return CROP_MATERIALS.has(name)
}

/** Впрыскивает покачивание в вершинный шейдер материала. */
export function applySway(mat: THREE.Material): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = swayUniforms.uTime
    shader.vertexShader =
      'uniform float uTime;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec3 swayOrigin = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
         float swayPhase = swayOrigin.x * 1.3 + swayOrigin.z * 1.7;
         float swayAmp = 0.06 * max(transformed.y, 0.0);
         transformed.x += sin(uTime * 1.8 + swayPhase) * swayAmp;
         transformed.z += cos(uTime * 1.5 + swayPhase) * swayAmp * 0.5;`,
      )
  }
  // Отдельный ключ кэша программы, чтобы не смешать с обычным Lambert.
  mat.customProgramCacheKey = () => 'lambert-sway'
}
