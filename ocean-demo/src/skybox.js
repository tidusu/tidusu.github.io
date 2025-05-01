class SkyBox {
    _procedural;
    _scene;
    _skybox;
    _skyMaterial;
    _probe;
    _oldSunPosition;
    _skyboxObserver;
    _dirty;
    _dirtyCount;
    _needPolynomialsRegen;
    get probe() {
        return this._probe;
    }
    get skyMaterial() {
        return this._skyMaterial;
    }
    setAsDirty() {
        this._dirty = true;
        this._dirtyCount = 2;
        this._probe.cubeTexture.refreshRate = 1;
        this._needPolynomialsRegen = true;
    }
    constructor(useProcedural, scene) {
        this._procedural = useProcedural;
        this._scene = scene;
        this._oldSunPosition = new BABYLON.Vector3();
        this._skyMaterial = null;
        this._probe = null;
        this._dirty = false;
        this._dirtyCount = 0;
        this._needPolynomialsRegen = false;
        this._skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0, sideOrientation: BABYLON.Mesh.BACKSIDE }, this._scene);
        
        this._skybox.isPickable = false;
        
        // put the skybox first in the list
        scene.meshes.splice(scene.meshes.indexOf(this._skybox), 1);
        scene.meshes.splice(0, 0, this._skybox);
        this._skyboxObserver = scene.onBeforeRenderObservable.add(() => {
            this._skybox.position = scene.activeCameras?.[0].position ?? scene.activeCamera.position;
        });
        if (useProcedural) {
            this._initProceduralSkybox();
        }
        else {
            this._initSkybox();
        }
        this.setAsDirty();
    }
    update(light) {
        if (!this._procedural) {
            return false;
        }
        let ret = false;
        const texture = this._probe.cubeTexture.getInternalTexture();
        if (!this._oldSunPosition.equals(this._skyMaterial.sunPosition) || this._dirty) {
            this._oldSunPosition.copyFrom(this._skyMaterial.sunPosition);
            light.position = this._skyMaterial.sunPosition.clone();
            light.direction = this._skyMaterial.sunPosition.negate().normalize();
            light.diffuse = this._skyMaterial.getSunColor().toLinearSpace();
            if (this._dirtyCount-- === 0) {
                this._dirty = false;
                this._probe.cubeTexture.refreshRate = 0;
            }
            ret = true;
        }
        if (!this._dirty && this._needPolynomialsRegen && texture._sphericalPolynomialComputed) {
            this._probe.cubeTexture.forceSphericalPolynomialsRecompute();
            this._needPolynomialsRegen = false;
        }
        return ret;
    }
    dispose() {
        this._scene.onBeforeRenderObservable.remove(this._skyboxObserver);
        this._scene.customRenderTargets = [];
        if (this._procedural) {
            this._probe.dispose();
        }
        else {
            this._scene.environmentTexture?.dispose();
            this._skybox.material.reflectionTexture?.dispose();
        }
        this._skybox.material.dispose();
        this._skybox.dispose();
        this._scene.environmentTexture = null;
    }
    _initProceduralSkybox() {
        this._skyMaterial = new BABYLON.SkyMaterial("sky", this._scene);
        this._skybox.material = this._skyMaterial;
        this._skybox.material.disableDepthWrite = true;
        this._skyMaterial.azimuth = 0.558;
        this._skyMaterial.inclination = .283;
        // Reflection probe
        this._probe = new BABYLON.ReflectionProbe("skyProbe", 128, this._scene, true, true, true);
        this._probe.renderList.push(this._skybox);
        this._probe.attachToMesh(this._skybox);
        this._probe.cubeTexture.activeCamera = this._scene.activeCameras?.[0] ?? this._scene.activeCamera;
        this._probe.cubeTexture.refreshRate = 0;
        this._probe.cubeTexture.onAfterUnbindObservable.add(() => {
            const texture = this._probe.cubeTexture.getInternalTexture();
            if (texture._sphericalPolynomialComputed) {
                // the previous computation is finished, we can start a new one
                this._probe.cubeTexture.forceSphericalPolynomialsRecompute();
                this._needPolynomialsRegen = false;
            }
            else {
                this._needPolynomialsRegen = true;
            }
        });
        this._scene.environmentTexture = this._probe.cubeTexture;
        this._scene.customRenderTargets.push(this._probe.cubeTexture);
    }
    _initSkybox() {
        //const reflectionTexture = BABYLON.CubeTexture.CreateFromPrefilteredData("https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
        const reflectionTexture = new BABYLON.HDRCubeTexture("https://popov72.github.io/BabylonDev/resources/webgpu/oceanDemo/0c03bd6e3c9d04da0cf428bbf487bf68.hdr", this._scene, 256, false, true, false, true);
        const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this._scene);
        skyboxMaterial.disableDepthWrite = true;
        skyboxMaterial.reflectionTexture = reflectionTexture.clone();
        skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        this._skybox.material = skyboxMaterial;
        this._scene.environmentTexture = reflectionTexture;
    }
}
