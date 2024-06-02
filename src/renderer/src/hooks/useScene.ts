import {
  Engine,
  ArcRotateCamera,
  Scene,
  SceneLoader,
  Vector3,
  Mesh,
  Color3,
  HemisphericLight,
  DirectionalLight,
  AbstractMesh,
  SkeletonViewer,
  Color4
} from '@babylonjs/core'

import {
  VmdLoader,
  MmdRuntime,
  MmdAnimation,
  MmdModel,
  MmdAmmoPhysics,
  MmdAmmoJSPlugin
} from 'babylon-mmd'
import ammo from '../utils/ammo.wasm'
import { watch } from 'vue'
import { SelectedMotion, SelectedChar } from './useStates'

export async function useScene(canvas: HTMLCanvasElement) {
  const engine = new Engine(canvas, true, {}, true)

  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.12, 0.1, 0.18, 0)

  const ammoInstance = await ammo()
  const ammoPlugin = new MmdAmmoJSPlugin(true, ammoInstance)
  scene.enablePhysics(new Vector3(0, -1, 0), ammoPlugin)

  const initScene = () => {
    const camera = new ArcRotateCamera('ArcRotateCamera', 0, 0, 45, new Vector3(0, 12, 0), scene)
    camera.setPosition(new Vector3(0, 22, -25))
    camera.attachControl(canvas, false)
    camera.inertia = 0.8
    camera.speed = 10

    const hemisphericLight = new HemisphericLight('HemisphericLight', new Vector3(0, 1, 0), scene)
    hemisphericLight.intensity = 0.4
    hemisphericLight.specular = new Color3(0, 0, 0)
    hemisphericLight.groundColor = new Color3(1, 1, 1)

    const directionalLight = new DirectionalLight(
      'DirectionalLight',
      new Vector3(8, -15, 10),
      scene
    )
    directionalLight.intensity = 0.8
  }

  const vmdLoader = new VmdLoader(scene)
  let mmdRuntime: MmdRuntime, modelMesh: AbstractMesh, mmdModel: MmdModel, motion: MmdAnimation

  const initMMD = async () => {
    mmdRuntime = new MmdRuntime(scene, new MmdAmmoPhysics(scene))
    mmdRuntime.register(scene)

    await loadMesh()
    loadMotion()

    mmdRuntime.onPauseAnimationObservable.add(() => {
      if (mmdRuntime.currentTime == mmdRuntime.animationDuration) {
        mmdRuntime.seekAnimation(0, true)
        mmdRuntime.playAnimation()
      }
    })
  }

  const loadMesh = async () => {
    modelMesh = await SceneLoader.ImportMeshAsync(
      undefined,
      `./chars/${SelectedChar.value}/`,
      `${SelectedChar.value}.pmx`,
      scene
    ).then((result) => {
      const mesh = result.meshes[0]

      const skeletonViewer = new SkeletonViewer(result.skeletons[0], modelMesh, scene, false)
      skeletonViewer.isEnabled = true
      skeletonViewer.color = new Color3(1, 0, 0)
      return mesh
    })

    mmdModel = mmdRuntime.createMmdModel(modelMesh as Mesh)
  }

  const loadMotion = async () => {
    motion = await vmdLoader.loadAsync(
      `${SelectedMotion.value}`,
      `./motions/${SelectedMotion.value}.vmd`
    )
    mmdModel.addAnimation(motion)
    mmdModel.setAnimation(`${SelectedMotion.value}`)
    mmdRuntime.playAnimation()
  }

  watch(SelectedChar, async () => {
    if (mmdModel != undefined) {
      mmdRuntime.destroyMmdModel(mmdModel)
      mmdModel.dispose()
      modelMesh.dispose()
    }
    await loadMesh()
    loadMotion()
  })

  watch(SelectedMotion, async () => {
    if (mmdModel != undefined) {
      let exist = false
      for (const v of mmdModel.runtimeAnimations) {
        if (v.animation != undefined && v.animation.name == SelectedMotion.value) {
          exist = true
          break
        }
      }
      if (!exist) {
        loadMotion()
      } else {
        mmdModel.setAnimation(`${SelectedMotion.value}`)
        mmdRuntime.seekAnimation(0, true)
        mmdRuntime.playAnimation()
      }
    }
  })

  initScene()
  initMMD()

  engine.runRenderLoop(() => {
    engine.resize()
    scene.render()
  })
}
