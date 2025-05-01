const showBigBuoy = true;
const showWaveglider = true;
const showSoundBuoy = true;
class Ocean {
    _engine;
    _scene;
    _camera;
    _rttDebug;
    _light;
    _depthRenderer;
    _buoyancy;
    _wavesSettings;
    _fxaa;
    _size;
    _gui;
    _skybox;
    _oceanMaterial;
    _oceanGeometry;
    _wavesGenerator;
    _useZQSD;
    _useProceduralSky;
    _lightDirection;
    _shadowGenerator;
    _lightBuoy;
    _shadowGeneratorBuoy;
    _glowLayer;
    _forceUpdateGlowIntensity;
    constructor() {
        this._engine = null;
        this._scene = null;
        this._camera = null;
        this._rttDebug = null;
        this._light = null;
        this._depthRenderer = null;
        this._buoyancy = null;
        this._fxaa = null;
        this._gui = null;
        this._skybox = null;
        this._oceanMaterial = null;
        this._oceanGeometry = null;
        this._wavesGenerator = null;
        this._useZQSD = false;
        this._useProceduralSky = true;
        this._lightDirection = new BABYLON.Vector3(0, -1, -0.25);
        this._shadowGenerator = null;
        this._lightBuoy = null;
        this._shadowGeneratorBuoy = null;
        this._glowLayer = null;
        this._forceUpdateGlowIntensity = true;
        this._size = 0;
        this._wavesSettings = new WavesSettings();
        this._highlightLayer = null;        // BABYLON.HighlightLayer
        this._currentlyHighlighted = null;  // BABYLON.AbstractMesh
    }
    async createScene(engine, canvas) {
        BABYLON.SceneLoader.ShowLoadingScreen = false; // 不显示加载画面

        window.convf = function (l) { const a = new Uint8Array([l & 0xff, (l & 0xff00) >> 8, (l & 0xff0000) >> 16, (l & 0xff000000) >> 24]); return new Float32Array(a.buffer)[0]; };
        window.numbg = function () { console.log("NumBindGroupsCreatedTotal=", BABYLON.WebGPUCacheBindGroups.NumBindGroupsCreatedTotal, " - NumBindGroupsCreatedLastFrame=", BABYLON.WebGPUCacheBindGroups.NumBindGroupsCreatedLastFrame); };
        const scene = new BABYLON.Scene(engine);
        this._highlightLayer = new BABYLON.HighlightLayer("hl1", scene);
        scene.useRightHandedSystem = true;

        scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
              const pi = pointerInfo.pickInfo;
              // 先把旧的去掉
              if (this._currentlyHighlighted) {
                this._highlightLayer.removeMesh(this._currentlyHighlighted);
                this._currentlyHighlighted = null;
              }
              if (pi.hit && pi.pickedMesh) {
                const m = pi.pickedMesh;
                
                // （可选）只对三只浮标生效 选中
                // if (["bigbuoy","waveglider","soundbuoy"].includes(m.name)) {
                //   this._highlightLayer.addMesh(m, new BABYLON.Color3(1, 0.8, 0));  // 金黄色
                //   this._currentlyHighlighted = m;
                // }
                console.log("Picked mesh:", m.name);
              } else {
                console.log("Pointer down but no mesh hit");
              }
            }
          });

        this._engine = engine;
        this._scene = scene;
        this._camera = new BABYLON.UniversalCamera("mainCamera", new BABYLON.Vector3(-17.3, 5, -9), scene);
        this._camera.rotation.set(0.21402315044176745, 10.5974857677541419, 0);
        this._camera.minZ = 1;
        this._camera.maxZ = 100000;
        this._camera.rotation = new BABYLON.Vector3(0.21402315044176745, 1.5036907628093295, 0); // (debugNode as BABYLON.FreeCamera)0
        this._camera.position = new BABYLON.Vector3(-52.57105449009695, -1.962552063868964, -37.50012554064788); // (debugNode as BABYLON.FreeCamera)
        if (!this._checkSupport()) {
            return scene;
        }
        this._setCameraKeys();
        await OceanGUI.LoadDAT();
        this._rttDebug = new RTTDebug(scene, engine, 32);
        this._rttDebug.show(false);
        // HELP HERE - NEED TO GET RIG OF LIGHT FROM SPOT AND ONLY EMIT THE SHADOW TEXTURE
        // SPOT LIGHT NEEDS TO PROJECT RECTANGLE SHADOW TEXTURE ON SURFACES TO SIMULATE SHADOW UNDERNEATH A CAR
        scene.environmentIntensity = 1;
        scene.activeCameras = [this._camera, this._rttDebug.camera];
        this._camera.attachControl(canvas, true);
        const cameraUpdate = this._camera.update.bind(this._camera);
        this._camera.update = function () {
            cameraUpdate();
            // if (this.position.y < 1.5) {
            //     this.position.y = 1.5;
            // }
        };
        // // 暗角
        // var lensEffect = new BABYLON.LensRenderingPipeline('lens', {
        //     edge_blur: 1.0,
        //     chromatic_aberration: 1.0,
        //     distortion: 1.0,
        //     dof_focus_distance: 100,
        //     dof_aperture: 2.0,
        //     grain_amount: 1.0,
        //     dof_pentagon: true,
        //     dof_gain: 1.0,
        //     dof_threshold: 1.0,
        //     dof_darken: 0.25
        // }, scene, 1.0, [this._camera]);
        this._depthRenderer = this._scene.enableDepthRenderer(this._camera, false);
        this._depthRenderer.getDepthMap().renderList = [];
        this._light = new BABYLON.DirectionalLight("light", this._lightDirection, scene);
        this._light.intensity = .6;
        this._light.diffuse = new BABYLON.Color3(1, 1, 1);
        this._light.shadowMinZ = 0;
        this._light.shadowMaxZ = 40;
        this._light.shadowOrthoScale = 0.5;
        this._shadowGenerator = new BABYLON.ShadowGenerator(4096, this._light);
        this._shadowGenerator.usePercentageCloserFiltering = true;
        this._shadowGenerator.bias = 0.005;
        this._skybox = new SkyBox(this._useProceduralSky, scene);
        this._buoyancy = new Buoyancy(this._size, 3, 0.2);
        this._oceanMaterial = new OceanMaterial(this._depthRenderer, this._scene);
        this._oceanGeometry = new OceanGeometry(this._oceanMaterial, this._camera, this._scene);
        this._fxaa = new BABYLON.FxaaPostProcess("fxaa", 1, this._camera);
        await this._loadMeshes();
        var ground = BABYLON.Mesh.CreateGroundFromHeightMap("ground", "textures/heightMap.png", 100, 200, 400, 0, 10, scene, false);
        this._shadowGenerator.addShadowCaster(ground);
        ground.receiveShadows = true;
        //  ground.isVisible = true
        await this._updateSize(128);
        //scene.stopAllAnimations();
        this._oceanGeometry.initializeMeshes();
        this._gui = new OceanGUI(this._useProceduralSky, scene, engine, this._parameterRead.bind(this), this._parameterChanged.bind(this));
        if (location.href.indexOf("hidegui") !== -1) {
            this._gui.visible = false;
        }
        this._scene.onKeyboardObservable.add((kbInfo) => {
            switch (kbInfo.type) {
                case BABYLON.KeyboardEventTypes.KEYDOWN:
                    if (kbInfo.event.key === "Shift") {
                        this._camera.speed = 10;
                    }
                    break;
                case BABYLON.KeyboardEventTypes.KEYUP:
                    if (kbInfo.event.key === "Shift") {
                        this._camera.speed = 2;
                    }
                    break;
            }
        });
        scene.onBeforeRenderObservable.add(() => {
            if (this._skybox.update(this._light) || this._forceUpdateGlowIntensity) {
                if (this._glowLayer) {
                    const minIntensity = 0.6;
                    const maxIntensity = 3;
                    const sunPos = this._light.position.clone().normalize();
                    const sunProj = sunPos.clone().normalize();
                    sunProj.y = 0;
                    const dot = BABYLON.Vector3.Dot(sunPos, sunProj);
                    const intensity = BABYLON.Scalar.Lerp(minIntensity, maxIntensity, BABYLON.Scalar.Clamp(dot, 0, 1));
                    this._glowLayer.intensity = sunPos.y < 0 ? maxIntensity : intensity;
                    this._forceUpdateGlowIntensity = false;
                }
                this._light.position = this._light.position.clone().normalize().scaleInPlace(30);
            }
            this._oceanGeometry.update();
            this._wavesGenerator.update();
            this._buoyancy.setWaterHeightMap(this._wavesGenerator.waterHeightMap, this._wavesGenerator.waterHeightMapScale);
            this._buoyancy.update();
        });
        scene.onAfterRenderObservable.addOnce(async () => {
            //ssr.environmentTexture = skyboxMaterial.reflectionTexture;
            //     this._oceanGeometry._materials.forEach(mat => {
            //         console.log(mat)
            //      const plugin = new UnderseaFogPluginMaterial(mat);
            //         plugin.isEnabled = true
            //         plugin.setWavesGenerator(this._wavesGenerator)
            // })
            // var spotLight = new BABYLON.SpotLight("spot02", new BABYLON.Vector3(0, 90, 0), new BABYLON.Vector3(0, -1, 0), BABYLON.Tools.ToRadians(70), 32, scene);
            // var proj_tex = (this._rttDebug.debugPlaneList[20].material as any)._emissiveTexture
            // proj_tex.uScale = 10000;
            // proj_tex.vScale = 10000;
            // spotLight.projectionTexture = (this._rttDebug.debugPlaneList[19].material as any)._emissiveTexture
            // // spotLight.projectionTexture = new BABYLON.VideoTexture("vidtex", "https://raw.githubusercontent.com/Propolisa/files/refs/heads/main/caustics_opengameart_thanks_to_calinau.mp4", scene, false, false,undefined, {});
            // spotLight.projectionTexture.wrapU = BABYLON.Constants.TEXTURE_WRAP_ADDRESSMODE ;
            // spotLight.projectionTexture.wrapV = BABYLON.Constants.TEXTURE_WRAP_ADDRESSMODE ;
            // spotLight.setDirectionToTarget(BABYLON.Vector3.Zero());
            // spotLight.intensity = 5;
            // @ts-ignore
            BABYLON.RegisterMaterialPlugin("UnderseaFog", (material) => {
                // @ts-ignore
                material.fog = new UnderseaFogPluginMaterial(material);
                // @ts-ignore
                // let debug_buffer = new BABYLON.StorageBuffer(engine, Float32Array.BYTES_PER_ELEMENT * 6 * engine.getRenderWidth() * engine.getRenderHeight() )
                //@ts-ignore
                // @ts-ignore
                // debugger
                //@ts-ignore
                material.fog.setWavesGenerator(this._wavesGenerator);
                // debugger
                // @ts-ignore
                // material.fog.isEnabled = true
                // @ts-ignore
                return material.fog;
            });
            BABYLON.SceneLoader.ImportMeshAsync("", "https://models.babylonjs.com/", "shark.glb", scene).then(({ meshes, animationGroups }) => {
                // debugger
                meshes[0].position = new BABYLON.Vector3(37, -7, -50);
                // meshes[1].bakeCurrentTransformIntoVertices();
                animationGroups[1].start(true);
                meshes.forEach(mesh => {
                    this._shadowGenerator.addShadowCaster(mesh);
                    mesh.receiveShadows = true;
                    //@ts-ignore
                    if (mesh.material?.fog) {
                        //@ts-ignore
                        mesh.material.fog.isEnabled = true;
                    }
                });
                return { meshes, animationGroups };
            });
            let ground = scene.getMeshByName("ground");
            var groundMaterial = new BABYLON.StandardMaterial("ground", scene);
            let tex = new BABYLON.Texture("textures/ground.jpg", scene);
            tex.uScale = 6;
            tex.vScale = 6;
            groundMaterial.diffuseTexture = tex;
            groundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
            ground.position.y = -25.05;
            ground.position.x = 5;
            ground.scaling.y = 5;
            ground.material = groundMaterial;
            // ground.isVisible = false
            const sphere = BABYLON.MeshBuilder.CreateSphere("sphere", { slice: 0.5, sideOrientation: BABYLON.Mesh.DOUBLESIDE });
            sphere.isPickable = false;
            sphere.rotate(BABYLON.Axis.X, Math.PI);
            sphere.scaling.z = 500;
            sphere.position.y = 0;
            sphere.scaling.x = 500;
            sphere.scaling.y = 100;
            sphere.material = groundMaterial;
            // sphere.isVisible = false
            // @ts-ignore
            // sphere.material.fog.isEnabled = true
            // debugger
            // @ts-ignore
            ground.material.fog.isEnabled = true;
            //       var plane = BABYLON.MeshBuilder.CreateGround("plane", {width: 200, height:200})
            // plane.material = new BABYLON.StandardMaterial("mattt")
            // plane.position.y = -50
            // // @ts-ignore
            // plane.material.fog.isEnabled = true
        });
        return new Promise((resolve) => {
            scene.executeWhenReady(() => resolve(scene));
        });
    }
    _setCameraKeys() {
        const kbInputs = this._camera.inputs.attached.keyboard;
        if (this._useZQSD) {
            kbInputs.keysDown = [40, 83];
            kbInputs.keysLeft = [37, 81];
            kbInputs.keysRight = [39, 68];
            kbInputs.keysUp = [38, 90];
        }
        else {
            kbInputs.keysDown = [40, 83];
            kbInputs.keysLeft = [37, 65];
            kbInputs.keysRight = [39, 68];
            kbInputs.keysUp = [38, 87];
        }
        kbInputs.keysDownward = [34, 32];
        kbInputs.keysUpward = [33, 69];
    }
    _checkSupport() {
        if (this._engine.getCaps().supportComputeShaders) {
            const panel = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
 
            const textNOk = "**This demo might not work for everyone because of an issue in Chrome.\nPlease follow https://bugs.chromium.org/p/dawn/issues/detail?id=1701 for more information.**";
        
            const info = new BABYLON.GUI.TextBlock();
            // info.text = textNOk;
            // info.width = "100%";
            // info.paddingLeft = "5px";
            // info.paddingRight = "5px";
            // info.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
            // info.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
            // info.color = "red";
            // info.fontSize = "24px";
            // info.fontStyle = "bold";
            // info.textWrapping = true;
            // panel.addControl(info); 
            return true;
        }
        const panel = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
        const textNOk = "**Use WebGPU to watch this demo which requires compute shaders support. To enable WebGPU please use Chrome Canary or Edge canary. Also select the WebGPU engine from the top right drop down menu.**";
        const info = new BABYLON.GUI.TextBlock();
        info.text = textNOk;
        info.width = "100%";
        info.paddingLeft = "5px";
        info.paddingRight = "5px";
        info.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        info.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        info.color = "red";
        info.fontSize = "24px";
        info.fontStyle = "bold";
        info.textWrapping = true;
        panel.addControl(info);
        return false;
    }
    async _loadMeshes() {
        // Buoy
        if (showBigBuoy) {
            await BABYLON.SceneLoader.AppendAsync("", "./assets/bigbuoy.glb", this._scene, undefined, ".glb");
            const buoyMeshes = [this._scene.getMeshByName("bigbuoy")];
            const buoyRoot = buoyMeshes[0].parent;
            const scale = 14;
            buoyRoot.position.z = -4;
            buoyRoot.scaling.setAll(scale);
            buoyMeshes.forEach((mesh) => {
                mesh.material.backFaceCulling = false;
                this._shadowGenerator.addShadowCaster(mesh);
                mesh.receiveShadows = true;
                this._depthRenderer.getDepthMap().renderList.push(mesh);
            });
            buoyRoot.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(0, Math.PI / 3, 0);
            this._buoyancy.addMesh(buoyRoot, { v1: new BABYLON.Vector3(0.7 / scale, 1 / scale, -1.5 / scale), v2: new BABYLON.Vector3(0.7 / scale, 1 / scale, 1.5 / scale), v3: new BABYLON.Vector3(-1.5 / scale, 1 / scale, -1.5 / scale) }, 0.0, 2);
            const slight = BABYLON.MeshBuilder.CreateSphere("slight", { segments: 6, diameter: 0.5 / scale }, this._scene);
            slight.position.set(-0.6 / scale, 6.58 / scale, 0.3 / scale);
            slight.visibility = 0;
            slight.parent = buoyRoot;

        }

        if (showWaveglider) {
            await BABYLON.SceneLoader.AppendAsync("", "./assets/waveglider.glb", this._scene, undefined, ".glb");
            const wavegliderMeshes = [this._scene.getMeshByName("waveglider")];
            const wavegliderRoot = wavegliderMeshes[0].parent;
            const scale = 14;
            wavegliderRoot.scaling.setAll(scale);
            wavegliderRoot.position.x = -10;
            wavegliderRoot.position.y = -10;
            // wavegliderRoot.position.z = -10;
                // 保证所有子 mesh 都可 pick
            wavegliderRoot.getChildMeshes().forEach(mesh => mesh.isPickable = true);
            wavegliderMeshes.forEach((mesh) => {
                mesh.material.backFaceCulling = false;
                this._shadowGenerator.addShadowCaster(mesh);
                mesh.receiveShadows = true;
                this._depthRenderer.getDepthMap().renderList.push(mesh);
            });
            wavegliderRoot.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(0, Math.PI / 3, 0);
            this._buoyancy.addMesh(wavegliderRoot, { v1: new BABYLON.Vector3(0.7 / scale, 1 / scale, -1.5 / scale), v2: new BABYLON.Vector3(0.7 / scale, 1 / scale, 1.5 / scale), v3: new BABYLON.Vector3(-1.5 / scale, 1 / scale, -1.5 / scale) }, 0.0, 2);
            // const slight = BABYLON.MeshBuilder.CreateSphere("slight", { segments: 6, diameter: 0.5 / scale }, this._scene);
            // slight.position.set(-0.6 / scale, 6.58 / scale, 0.3 / scale);
            // slight.visibility = 0;
            // slight.parent = wavegliderRoot;
        }
        if (showSoundBuoy) {
            await BABYLON.SceneLoader.AppendAsync("", "./assets/soundbuoy.glb", this._scene, undefined, ".glb");
            const soundBuoyMeshes = [this._scene.getMeshByName("soundbuoy")];
            const soundBuoyRoot = soundBuoyMeshes[0].parent;
            const scale = 14;
            soundBuoyRoot.scaling.setAll(scale);
            soundBuoyRoot.position.x = -10;
            soundBuoyRoot.position.y = -10;
            // soundBuoyRoot.position.z = -10;
            soundBuoyRoot.getChildMeshes().forEach(mesh => mesh.isPickable = true);
            soundBuoyMeshes.forEach((mesh) => {
                mesh.material.backFaceCulling = false;
                this._shadowGenerator.addShadowCaster(mesh);
                mesh.receiveShadows = true;
                this._depthRenderer.getDepthMap().renderList.push(mesh);
            });
            soundBuoyRoot.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(0, Math.PI / 3, 0);
            this._buoyancy.addMesh(soundBuoyRoot, { v1: new BABYLON.Vector3(0.7 / scale, 1 / scale, -1.5 / scale), v2: new BABYLON.Vector3(0.7 / scale, 1 / scale, 1.5 / scale), v3: new BABYLON.Vector3(-1.5 / scale, 1 / scale, -1.5 / scale) }, -50.0, 5);
            // const slight = BABYLON.MeshBuilder.CreateSphere("slight", { segments: 6, diameter: 0.5 / scale }, this._scene);
            // slight.position.set(-0.6 / scale, 6.58 / scale, 0.3 / scale);
            // slight.visibility = 0;
            // slight.parent = soundBuoyRoot;

// 4. 飞向摄像机的函数（同之前示例）
function flyCameraTo(targetMesh) {
  
    const targetPos   = targetMesh.getAbsolutePosition();
    const endCamPos   = targetPos.add(new BABYLON.Vector3(0, 2, -5));
    const startCamPos = this._camera.position.clone();
  
    // 1) 位置动画
    BABYLON.Animation.CreateAndStartAnimation(
      "flyPos", this._camera, "position",
      60,        // 帧率
      120,       // 帧数（2秒）
      startCamPos,
      endCamPos,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  
    // 2) 动画结束后，手动 setTarget
    //    CreateAndStartAnimation 返回的是 Animatable，可以监听 onAnimationEnd
    const anim = BABYLON.Animation.CreateAndStartAnimation(
      "flyDummy", this._camera, "position", 60, 120,
      startCamPos, endCamPos,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    anim.onAnimationEnd = () => {
      this._camera.setTarget(targetPos);
    };
  }

            // this._lightBuoy = new BABYLON.PointLight("point", new BABYLON.Vector3(0, 0, 0), this._scene);
            // this._lightBuoy.intensity = 0;
            // this._lightBuoy.diffuse = new BABYLON.Color3(0.96, 0.70, 0.15).toLinearSpace();
            // this._lightBuoy.shadowMinZ = 0.01;
            // this._lightBuoy.shadowMaxZ = 15;
            // this._lightBuoy.parent = slight;
            // this._shadowGeneratorBuoy = new BABYLON.ShadowGenerator(2048, this._lightBuoy);
            // this._shadowGeneratorBuoy.usePoissonSampling = true;
            // this._shadowGeneratorBuoy.addShadowCaster(babylonBuoyMeshes[0]);
            // this._shadowGeneratorBuoy.bias = 0.01;
            // const sp1 = BABYLON.MeshBuilder.CreateSphere("sp1", { diameter: 1.2 / scale }, this._scene);
            // sp1.parent = babylonBuoyRoot;
            // sp1.position.x = 0.7 / scale;
            // sp1.position.y = 1 / scale;
            // sp1.position.z = -1.5 / scale;
 
            // const sp2 = BABYLON.MeshBuilder.CreateSphere("sp2", { diameter: 1.2 / scale }, this._scene);
            // sp2.parent = babylonBuoyRoot;
            // sp2.position.x = 0.7 / scale;
            // sp2.position.y = 1 / scale;
            // sp2.position.z = 1.5 / scale;
 
            // const sp3 = BABYLON.MeshBuilder.CreateSphere("sp3", { diameter: 1.2 / scale }, this._scene);
            // sp3.parent = babylonBuoyRoot;
            // sp3.position.x = -1.5 / scale;
            // sp3.position.y = 1 / scale;
            // sp3.position.z = -1.5 / scale;
        }
    }
    _createGlowLayer() {
        // this._glowLayer = new BABYLON.GlowLayer("glow", this._scene);
        // this._glowLayer.addIncludedOnlyMesh(this._scene.getMeshByName("glassCovers_low") as BABYLON.Mesh);
        // this._glowLayer.customEmissiveColorSelector = (mesh, subMesh, material, result) => {
        //     result.set(this._lightBuoy.diffuse.r, this._lightBuoy.diffuse.g, this._lightBuoy.diffuse.b, 1);
        // };
        // this._forceUpdateGlowIntensity = true;
    }
    async _updateSize(size) {
        this._size = size;
        this._buoyancy.size = size;
        const noise = await (await fetch("https://assets.babylonjs.com/environments/noise.exr")).arrayBuffer();
        this._wavesGenerator?.dispose();
        this._wavesGenerator = new WavesGenerator(this._size, this._wavesSettings, this._scene, this._rttDebug, noise);
        await this._wavesGenerator.initAsync();
        this._oceanMaterial.setWavesGenerator(this._wavesGenerator);
        await this._oceanGeometry.initializeMaterials();
    }
    _readValue(obj, name) {
        const parts = name.split("_");
        for (let i = 0; i < parts.length; ++i) {
            obj = obj[parts[i]];
        }
        return obj;
    }
    _setValue(obj, name, value) {
        const parts = name.split("_");
        for (let i = 0; i < parts.length - 1; ++i) {
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
    }
    _parameterRead(name) {
        switch (name) {
            case "size":
                return this._size;
            case "showDebugRTT":
                return this._rttDebug.isVisible;
            case "envIntensity":
                return this._scene.environmentIntensity;
            case "lightIntensity":
                return this._light.intensity;
            case "proceduralSky":
                return this._useProceduralSky;
            case "enableShadows":
                return this._light.shadowEnabled;
            case "enableFXAA":
                return this._fxaa !== null;
            case "enableGlow":
                return this._glowLayer !== null;
            case "useZQSD":
                return this._useZQSD;
            case "buoy_enabled":
                return this._buoyancy.enabled;
            case "buoy_attenuation":
                return this._buoyancy.attenuation;
            case "buoy_numSteps":
                return this._buoyancy.numSteps;
            case "skybox_lightColor":
                return this._light.diffuse.toHexString();
            case "skybox_directionX":
                return this._lightDirection.x;
            case "skybox_directionY":
                return this._lightDirection.y;
            case "skybox_directionZ":
                return this._lightDirection.z;
        }
        if (name.startsWith("procSky_")) {
            name = name.substring(8);
            return this._skybox.skyMaterial[name];
        }
        if (name.startsWith("waves_")) {
            name = name.substring(6);
            return this._readValue(this._wavesSettings, name);
        }
        if (name.startsWith("oceangeom_")) {
            name = name.substring(10);
            return this._readValue(this._oceanGeometry, name);
        }
        if (name.startsWith("oceanshader_")) {
            name = name.substring(12);
            return this._oceanMaterial.readMaterialParameter(this._oceanGeometry.getMaterial(0), name);
        }
    }
    _parameterChanged(name, value) {
        //console.log(name, "=", value);
        switch (name) {
            case "size": {
                const newSize = value | 0;
                if (newSize !== this._size) {
                    this._updateSize(newSize);
                }
                break;
            }
            case "showDebugRTT":
                this._rttDebug.show(!!value);
                break;
            case "envIntensity":
                this._scene.environmentIntensity = parseFloat(value);
                break;
            case "lightIntensity":
                this._light.intensity = parseFloat(value);
                break;
            case "enableShadows":
                this._light.shadowEnabled = !!value;
                if (this._lightBuoy) {
                    this._lightBuoy.shadowEnabled = !!value;
                }
                break;
            case "enableFXAA":
                if (value) {
                    if (!this._fxaa) {
                        this._fxaa = new BABYLON.FxaaPostProcess("fxaa", 1, this._camera);
                        this._fxaa.samples = this._engine.getCaps().maxMSAASamples;
                    }
                }
                else if (this._fxaa) {
                    this._fxaa.dispose();
                    this._fxaa = null;
                }
                break;
            case "enableGlow":
                if (this._glowLayer) {
                    this._glowLayer.dispose();
                    this._glowLayer = null;
                }
                else {
                    this._createGlowLayer();
                }
                break;
            case "proceduralSky":
                value = !!value;
                if (this._useProceduralSky !== value) {
                    this._gui.dispose();
                    this._skybox.dispose();
                    this._useProceduralSky = value;
                    this._skybox = new SkyBox(this._useProceduralSky, this._scene);
                    this._gui = new OceanGUI(this._useProceduralSky, this._scene, this._engine, this._parameterRead.bind(this), this._parameterChanged.bind(this));
                }
                break;
            case "useZQSD":
                this._useZQSD = !!value;
                this._setCameraKeys();
                break;
            case "buoy_enabled":
                this._buoyancy.enabled = !!value;
                break;
            case "buoy_attenuation":
                this._buoyancy.attenuation = parseFloat(value);
                break;
            case "buoy_numSteps":
                this._buoyancy.numSteps = value | 0;
                break;
            case "skybox_lightColor":
                this._light.diffuse.copyFrom(BABYLON.Color3.FromHexString(value));
                break;
            case "skybox_directionX":
                this._lightDirection.x = parseFloat(value);
                this._light.direction = this._lightDirection.normalizeToNew();
                break;
            case "skybox_directionY":
                this._lightDirection.y = parseFloat(value);
                this._light.direction = this._lightDirection.normalizeToNew();
                break;
            case "skybox_directionZ":
                this._lightDirection.z = parseFloat(value);
                this._light.direction = this._lightDirection.normalizeToNew();
                break;
        }
        if (name.startsWith("procSky_")) {
            name = name.substring(8);
            this._setValue(this._skybox.skyMaterial, name, value === false ? false : value === true ? true : parseFloat(value));
            this._skybox.setAsDirty();
        }
        if (name.startsWith("waves_")) {
            name = name.substring(6);
            this._setValue(this._wavesSettings, name, value === false ? false : value === true ? true : parseFloat(value));
            this._wavesGenerator.initializeCascades();
        }
        if (name.startsWith("oceangeom_")) {
            name = name.substring(10);
            this._setValue(this._oceanGeometry, name, value === false ? false : value === true ? true : parseFloat(value));
            if (name !== "oceangeom_noMaterialLod") {
                this._oceanGeometry.initializeMeshes();
            }
        }
        if (name.startsWith("oceanshader_")) {
            name = name.substring(12);
            this._oceanMaterial.updateMaterialParameter(this._oceanGeometry.getMaterial(0), name, value);
            this._oceanMaterial.updateMaterialParameter(this._oceanGeometry.getMaterial(1), name, value);
            this._oceanMaterial.updateMaterialParameter(this._oceanGeometry.getMaterial(2), name, value);
        }
    }
}