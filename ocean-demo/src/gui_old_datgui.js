// import { Pane } from "../js/tweakpane.min.js";

class OceanGUI {
    _gui;
    _visible;
    _scene;
    _paramRead;
    _paramChanged;
    _onKeyObserver;
    static LoadDAT() {
        return BABYLON.Tools.LoadScriptAsync("https://cdnjs.cloudflare.com/ajax/libs/dat-gui/0.6.2/dat.gui.min.js");
    }
    set visible(v) {
        if (v === this._visible) {
            return;
        }
        this._visible = v;
        this._gui.domElement.style.display = v ? "" : "none";
    }
    constructor(hasProceduralSky, scene, engine, paramRead, paramChanged) {
        this._scene = scene;
        this._visible = true;
        this._onKeyObserver = null;
        this._paramRead = paramRead;
        this._paramChanged = paramChanged;
        const oldgui = document.getElementById("datGUI");
        if (oldgui !== null) {
            oldgui.remove();
        }
        this._gui = new dat.GUI();
        this._gui.domElement.style.marginTop = "60px";
        this._gui.domElement.id = "datGUI";
        this._setupKeyboard();
        this._initialize(hasProceduralSky);
    }
    dispose() {
        const oldgui = document.getElementById("datGUI");
        if (oldgui !== null) {
            oldgui.remove();
        }
        this._scene.onKeyboardObservable.remove(this._onKeyObserver);
    }
    _setupKeyboard() {
        this._onKeyObserver = this._scene.onKeyboardObservable.add((kbInfo) => {
            switch (kbInfo.type) {
                case BABYLON.KeyboardEventTypes.KEYDOWN:
                    //console.log("KEY DOWN: ", kbInfo.event.key);
                    break;
                case BABYLON.KeyboardEventTypes.KEYUP:
                    switch (kbInfo.event.key) {
                        case "F8": {
                            this.visible = !this._visible;
                            break;
                        }
                    }
                    //console.log("KEY UP: ", kbInfo.event.key, kbInfo.event.keyCode);
                    break;
            }
        });
    }
    _initialize(hasProceduralSky) {
        this._makeMenuGeneral();
        if (hasProceduralSky) {
            this._makeMenuProceduralSky();
        }
        else {
            this._makeMenuSkybox();
        }
        this._makeMenuWavesGenerator();
        this._makeMenuOceanGeometry();
        this._makeMenuOceanShader();
        this._makeMenuBuoyancy();
    }
    _addList(menu, params, name, friendlyName, list) {
        menu.add(params, name, list)
            .name(friendlyName)
            .onChange((value) => {
                this._paramChanged(name, value);
            });
    }
    _addCheckbox(menu, params, name, friendlyName) {
        menu.add(params, name)
            .name(friendlyName)
            .onChange((value) => {
                this._paramChanged(name, value);
            });
    }
    _addSlider(menu, params, name, friendlyName, min, max, step) {
        menu.add(params, name, min, max, step)
            .name(friendlyName)
            .onChange((value) => {
                this._paramChanged(name, value);
            });
    }
    _addColor(menu, params, name, friendlyName) {
        menu.addColor(params, name)
            .name(friendlyName)
            .onChange((value) => {
                this._paramChanged(name, value);
            });
    }
    _makeMenuGeneral() {
        const params = {
            size: this._paramRead("size"),
            envIntensity: this._paramRead("envIntensity"),
            lightIntensity: this._paramRead("lightIntensity"),
            //proceduralSky: this._paramRead("proceduralSky"),
            enableShadows: this._paramRead("enableShadows"),
            //enableFXAA: this._paramRead("enableFXAA"),
            enableGlow: this._paramRead("enableGlow"),
            useZQSD: this._paramRead("useZQSD"),
            showDebugRTT: this._paramRead("showDebugRTT"),
        };
        const general = this._gui.addFolder("General");
        this._addList(general, params, "size", "Resolution", [256, 128, 64, 32]);
        this._addSlider(general, params, "envIntensity", "Env intensity", 0, 4, 0.05);
        this._addSlider(general, params, "lightIntensity", "Light intensity", 0, 5, 0.05);
        //this._addCheckbox(general, params, "proceduralSky", "Procedural sky");
        this._addCheckbox(general, params, "enableShadows", "Enable shadows");
        //this._addCheckbox(general, params, "enableFXAA", "Enable FXAA");
        this._addCheckbox(general, params, "enableGlow", "Enable Glow layer");
        this._addCheckbox(general, params, "useZQSD", "Use ZQSD");
        this._addCheckbox(general, params, "showDebugRTT", "Show debug RTT");
        general.open();
    }
    _makeMenuProceduralSky() {
        const params = {
            procSky_inclination: this._paramRead("procSky_inclination"),
            procSky_azimuth: this._paramRead("procSky_azimuth"),
            procSky_luminance: this._paramRead("procSky_luminance"),
            procSky_turbidity: this._paramRead("procSky_turbidity"),
            procSky_rayleigh: this._paramRead("procSky_rayleigh"),
            procSky_mieCoefficient: this._paramRead("procSky_mieCoefficient"),
            procSky_mieDirectionalG: this._paramRead("procSky_mieDirectionalG"),
        };
        const proceduralSky = this._gui.addFolder("Sky");
        this._addSlider(proceduralSky, params, "procSky_inclination", "Inclination", -0.5, 0.5, 0.001);
        this._addSlider(proceduralSky, params, "procSky_azimuth", "Azimuth", 0.0, 1, 0.001);
        this._addSlider(proceduralSky, params, "procSky_luminance", "Luminance", 0.001, 1, 0.001);
        this._addSlider(proceduralSky, params, "procSky_turbidity", "Turbidity", 0.1, 100, 0.1);
        this._addSlider(proceduralSky, params, "procSky_rayleigh", "Rayleigh", 0.1, 10, 0.1);
        this._addSlider(proceduralSky, params, "procSky_mieCoefficient", "Mie Coefficient", 0.0, 0.1, 0.0001);
        this._addSlider(proceduralSky, params, "procSky_mieDirectionalG", "Mie DirectionalG", 0.0, 1, 0.01);
        proceduralSky.open();
    }
    _makeMenuSkybox() {
        const params = {
            skybox_lightColor: this._paramRead("skybox_lightColor"),
            skybox_directionX: this._paramRead("skybox_directionX"),
            skybox_directionY: this._paramRead("skybox_directionY"),
            skybox_directionZ: this._paramRead("skybox_directionZ"),
        };
        const skybox = this._gui.addFolder("Sky");
        this._addColor(skybox, params, "skybox_lightColor", "Light color");
        this._addSlider(skybox, params, "skybox_directionX", "Light dir X", -10, 10, 0.001);
        this._addSlider(skybox, params, "skybox_directionY", "Light dir Y", -10, -0.01, 0.001);
        this._addSlider(skybox, params, "skybox_directionZ", "Light dir Z", -10, 10, 0.001);
    }
    _makeMenuWavesGenerator() {
        const params = {
            waves_g: this._paramRead("waves_g"),
            waves_depth: this._paramRead("waves_depth"),
            waves_lambda: this._paramRead("waves_lambda"),
            waves_local_scale: this._paramRead("waves_local_scale"),
            waves_local_windSpeed: this._paramRead("waves_local_windSpeed"),
            waves_local_windDirection: this._paramRead("waves_local_windDirection"),
            waves_local_fetch: this._paramRead("waves_local_fetch"),
            waves_local_spreadBlend: this._paramRead("waves_local_spreadBlend"),
            waves_local_swell: this._paramRead("waves_local_swell"),
            waves_local_peakEnhancement: this._paramRead("waves_local_peakEnhancement"),
            waves_local_shortWavesFade: this._paramRead("waves_local_shortWavesFade"),
            waves_swell_scale: this._paramRead("waves_swell_scale"),
            waves_swell_windSpeed: this._paramRead("waves_swell_windSpeed"),
            waves_swell_windDirection: this._paramRead("waves_swell_windDirection"),
            waves_swell_fetch: this._paramRead("waves_swell_fetch"),
            waves_swell_spreadBlend: this._paramRead("waves_swell_spreadBlend"),
            waves_swell_swell: this._paramRead("waves_swell_swell"),
            waves_swell_peakEnhancement: this._paramRead("waves_swell_peakEnhancement"),
            waves_swell_shortWavesFade: this._paramRead("waves_swell_shortWavesFade"),
        };
        const wavesGenerator = this._gui.addFolder("Waves Generator");
        this._addSlider(wavesGenerator, params, "waves_g", "Gravity", 0.01, 30, 0.01);
        this._addSlider(wavesGenerator, params, "waves_depth", "Ocean depth", 0.001, 3, 0.001);
        this._addSlider(wavesGenerator, params, "waves_lambda", "Lambda", 0.0, 1, 0.001);
        const local = wavesGenerator.addFolder("Local");
        this._addSlider(local, params, "waves_local_scale", "Scale", 0.0, 1, 0.001);
        this._addSlider(local, params, "waves_local_windSpeed", "Wind speed", 0.001, 100, 0.001);
        this._addSlider(local, params, "waves_local_windDirection", "Wind direction", -100.0, 100, 0.1);
        this._addSlider(local, params, "waves_local_fetch", "Fetch", 100, 1000000, 100);
        this._addSlider(local, params, "waves_local_spreadBlend", "Spread blend", 0, 1, 0.01);
        this._addSlider(local, params, "waves_local_swell", "Swell", 0, 1, 0.01);
        this._addSlider(local, params, "waves_local_peakEnhancement", "Peak enhanc.", 0.01, 100, 0.01);
        this._addSlider(local, params, "waves_local_shortWavesFade", "Short waves fade", 0.001, 1, 0.001);
        local.open();
        const swell = wavesGenerator.addFolder("Swell");
        this._addSlider(swell, params, "waves_swell_scale", "Scale", 0.0, 1, 0.001);
        this._addSlider(swell, params, "waves_swell_windSpeed", "Wind speed", 0.001, 100, 0.001);
        this._addSlider(swell, params, "waves_swell_windDirection", "Wind direction", -100.0, 100, 0.1);
        this._addSlider(swell, params, "waves_swell_fetch", "Fetch", 100, 1000000, 100);
        this._addSlider(swell, params, "waves_swell_spreadBlend", "Spread blend", 0, 1, 0.01);
        this._addSlider(swell, params, "waves_swell_swell", "Swell", 0, 1, 0.01);
        this._addSlider(swell, params, "waves_swell_peakEnhancement", "Peak enhanc.", 0.01, 100, 0.01);
        this._addSlider(swell, params, "waves_swell_shortWavesFade", "Short waves fade", 0.001, 1, 0.001);
        swell.open();
        wavesGenerator.open();
    }
    _makeMenuOceanGeometry() {
        const params = {
            oceangeom_lengthScale: this._paramRead("oceangeom_lengthScale"),
            oceangeom_vertexDensity: this._paramRead("oceangeom_vertexDensity"),
            oceangeom_clipLevels: this._paramRead("oceangeom_clipLevels"),
            oceangeom_skirtSize: this._paramRead("oceangeom_skirtSize"),
            oceangeom_wireframe: this._paramRead("oceangeom_wireframe"),
            oceangeom_noMaterialLod: this._paramRead("oceangeom_noMaterialLod"),
        };
        const oceanGeometry = this._gui.addFolder("Ocean Geometry");
        this._addSlider(oceanGeometry, params, "oceangeom_lengthScale", "Length scale", 1, 100, 0.1);
        this._addSlider(oceanGeometry, params, "oceangeom_vertexDensity", "Vertex density", 1, 40, 1);
        this._addSlider(oceanGeometry, params, "oceangeom_clipLevels", "Clip levels", 1, 8, 1);
        this._addSlider(oceanGeometry, params, "oceangeom_skirtSize", "Skirt size", 0, 100, 0.1);
        this._addCheckbox(oceanGeometry, params, "oceangeom_wireframe", "Wireframe");
        this._addCheckbox(oceanGeometry, params, "oceangeom_noMaterialLod", "No material LOD");
    }
    _makeMenuOceanShader() {
        const params = {
            oceanshader__Color: this._paramRead("oceanshader__Color"),
            oceanshader__MaxGloss: this._paramRead("oceanshader__MaxGloss"),
            oceanshader__RoughnessScale: this._paramRead("oceanshader__RoughnessScale"),
            oceanshader__LOD_scale: this._paramRead("oceanshader__LOD_scale"),
            oceanshader__FoamColor: this._paramRead("oceanshader__FoamColor"),
            oceanshader__FoamScale: this._paramRead("oceanshader__FoamScale"),
            oceanshader__ContactFoam: this._paramRead("oceanshader__ContactFoam"),
            oceanshader__FoamBiasLOD2: this._paramRead("oceanshader__FoamBiasLOD2"),
            oceanshader__SSSColor: this._paramRead("oceanshader__SSSColor"),
            oceanshader__SSSStrength: this._paramRead("oceanshader__SSSStrength"),
            oceanshader__SSSBase: this._paramRead("oceanshader__SSSBase"),
            oceanshader__SSSScale: this._paramRead("oceanshader__SSSScale"),
        };
        const oceanShader = this._gui.addFolder("Ocean Shader");
        this._addColor(oceanShader, params, "oceanshader__Color", "Color");
        this._addSlider(oceanShader, params, "oceanshader__MaxGloss", "Max gloss", 0.0, 1, 0.01);
        this._addSlider(oceanShader, params, "oceanshader__RoughnessScale", "Roughness scale", 0.0, 1, 0.0001);
        this._addSlider(oceanShader, params, "oceanshader__LOD_scale", "LOD scale", 0.01, 20, 0.01);
        this._addColor(oceanShader, params, "oceanshader__FoamColor", "Foam color");
        this._addSlider(oceanShader, params, "oceanshader__FoamScale", "Foam scale", 0.001, 8, 0.001);
        this._addSlider(oceanShader, params, "oceanshader__ContactFoam", "Foam contact", 0.001, 3, 0.001);
        this._addSlider(oceanShader, params, "oceanshader__FoamBiasLOD2", "Foam bias", 0.001, 4, 0.001);
        this._addColor(oceanShader, params, "oceanshader__SSSColor", "SSS color");
        this._addSlider(oceanShader, params, "oceanshader__SSSStrength", "SSS strength", 0.001, 2, 0.001);
        this._addSlider(oceanShader, params, "oceanshader__SSSBase", "SSS base", -2, 1, 0.001);
        this._addSlider(oceanShader, params, "oceanshader__SSSScale", "SSS scale", 0.001, 10, 0.001);
    }
    _makeMenuBuoyancy() {
        const params = {
            buoy_enabled: this._paramRead("buoy_enabled"),
            buoy_attenuation: this._paramRead("buoy_attenuation"),
            buoy_numSteps: this._paramRead("buoy_numSteps"),
        };
        const buoyancy = this._gui.addFolder("Buoyancy");
        this._addCheckbox(buoyancy, params, "buoy_enabled", "Enabled");
        this._addSlider(buoyancy, params, "buoy_attenuation", "Damping factor", 0, 1, 0.001);
        this._addSlider(buoyancy, params, "buoy_numSteps", "Num steps", 1, 20, 1);
    }
}

export class OceanGUI {
    _pane;
    _visible = true;
    _scene;
    _paramRead;
    _paramChanged;
    _onKeyObserver;
  
    constructor(hasProceduralSky, scene, engine, paramRead, paramChanged) {
      this._scene = scene;
      this._paramRead = paramRead;
      this._paramChanged = paramChanged;
      // 初始化 Tweakpane
      this._pane = new Tweakpane.Pane({
        title: 'Ocean Controls',
        container: document.body,
      });
  
      this._setupKeyboard();
      this._initialize(hasProceduralSky);
    }
  
    /** 控制面板显示/隐藏 */
    set visible(v) {
      if (v === this._visible) return;
      this._visible = v;
      this._pane.element.style.display = v ? '' : 'none';
    }
  
    dispose() {
      // 移除键盘监听
      if (this._onKeyObserver) {
        this._scene.onKeyboardObservable.remove(this._onKeyObserver);
      }
      // 销毁面板
      this._pane.dispose();
    }
  
    _setupKeyboard() {
      this._onKeyObserver = this._scene.onKeyboardObservable.add((kbInfo) => {
        if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYUP && kbInfo.event.key === 'F8') {
          this.visible = !this._visible;
        }
      });
    }
  
    _initialize(hasProceduralSky) {
      this._makeMenuGeneral();
      if (hasProceduralSky) {
        this._makeMenuProceduralSky();
      } else {
        this._makeMenuSkybox();
      }
      this._makeMenuWavesGenerator();
      this._makeMenuOceanGeometry();
      this._makeMenuOceanShader();
      this._makeMenuBuoyancy();
    }
  
    _makeMenuGeneral() {
      const params = {
        size: this._paramRead('size'),
        envIntensity: this._paramRead('envIntensity'),
        lightIntensity: this._paramRead('lightIntensity'),
        enableShadows: this._paramRead('enableShadows'),
        enableGlow: this._paramRead('enableGlow'),
        useZQSD: this._paramRead('useZQSD'),
        showDebugRTT: this._paramRead('showDebugRTT'),
      };
      const folder = this._pane.addFolder({ title: 'General', expanded: true });
  
      folder
        .addInput(params, 'size', {
          label: 'Resolution',
          options: { '256': 256, '128': 128, '64': 64, '32': 32 },
        })
        .on('change', (ev) => this._paramChanged('size', ev.value));
  
      folder
        .addInput(params, 'envIntensity', { label: 'Env intensity', min: 0, max: 4, step: 0.05 })
        .on('change', (ev) => this._paramChanged('envIntensity', ev.value));
  
      folder
        .addInput(params, 'lightIntensity', { label: 'Light intensity', min: 0, max: 5, step: 0.05 })
        .on('change', (ev) => this._paramChanged('lightIntensity', ev.value));
  
      ['enableShadows', 'enableGlow', 'useZQSD', 'showDebugRTT'].forEach((key) => {
        folder
          .addInput(params, key, { label: key })
          .on('change', (ev) => this._paramChanged(key, ev.value));
      });
    }
  
    _makeMenuProceduralSky() {
      const params = {
        procSky_inclination: this._paramRead('procSky_inclination'),
        procSky_azimuth: this._paramRead('procSky_azimuth'),
        procSky_luminance: this._paramRead('procSky_luminance'),
        procSky_turbidity: this._paramRead('procSky_turbidity'),
        procSky_rayleigh: this._paramRead('procSky_rayleigh'),
        procSky_mieCoefficient: this._paramRead('procSky_mieCoefficient'),
        procSky_mieDirectionalG: this._paramRead('procSky_mieDirectionalG'),
      };
      const folder = this._pane.addFolder({ title: 'Procedural Sky', expanded: true });
  
      folder
        .addInput(params, 'procSky_inclination', { label: 'Inclination', min: -0.5, max: 0.5, step: 0.001 })
        .on('change', (ev) => this._paramChanged('procSky_inclination', ev.value));
  
      folder
        .addInput(params, 'procSky_azimuth', { label: 'Azimuth', min: 0, max: 1, step: 0.001 })
        .on('change', (ev) => this._paramChanged('procSky_azimuth', ev.value));
  
      folder
        .addInput(params, 'procSky_luminance', { label: 'Luminance', min: 0.001, max: 1, step: 0.001 })
        .on('change', (ev) => this._paramChanged('procSky_luminance', ev.value));
  
      folder
        .addInput(params, 'procSky_turbidity', { label: 'Turbidity', min: 0.1, max: 100, step: 0.1 })
        .on('change', (ev) => this._paramChanged('procSky_turbidity', ev.value));
  
      folder
        .addInput(params, 'procSky_rayleigh', { label: 'Rayleigh', min: 0.1, max: 10, step: 0.1 })
        .on('change', (ev) => this._paramChanged('procSky_rayleigh', ev.value));
  
      folder
        .addInput(params, 'procSky_mieCoefficient', { label: 'Mie Coefficient', min: 0, max: 0.1, step: 0.0001 })
        .on('change', (ev) => this._paramChanged('procSky_mieCoefficient', ev.value));
  
      folder
        .addInput(params, 'procSky_mieDirectionalG', { label: 'Mie DirectionalG', min: 0, max: 1, step: 0.01 })
        .on('change', (ev) => this._paramChanged('procSky_mieDirectionalG', ev.value));
    }
  
    _makeMenuSkybox() {
      const params = {
        skybox_lightColor: this._paramRead('skybox_lightColor'),
        skybox_directionX: this._paramRead('skybox_directionX'),
        skybox_directionY: this._paramRead('skybox_directionY'),
        skybox_directionZ: this._paramRead('skybox_directionZ'),
      };
      const folder = this._pane.addFolder({ title: 'Skybox', expanded: true });
  
      folder
        .addInput(params, 'skybox_lightColor', { label: 'Light color', view: 'color' })
        .on('change', (ev) => this._paramChanged('skybox_lightColor', ev.value));
  
      folder
        .addInput(params, 'skybox_directionX', { label: 'Dir X', min: -10, max: 10, step: 0.001 })
        .on('change', (ev) => this._paramChanged('skybox_directionX', ev.value));
  
      folder
        .addInput(params, 'skybox_directionY', { label: 'Dir Y', min: -10, max: -0.01, step: 0.001 })
        .on('change', (ev) => this._paramChanged('skybox_directionY', ev.value));
  
      folder
        .addInput(params, 'skybox_directionZ', { label: 'Dir Z', min: -10, max: 10, step: 0.001 })
        .on('change', (ev) => this._paramChanged('skybox_directionZ', ev.value));
    }
  
    _makeMenuWavesGenerator() {
      const params = {
        waves_g: this._paramRead('waves_g'),
        waves_depth: this._paramRead('waves_depth'),
        waves_lambda: this._paramRead('waves_lambda'),
        waves_local_scale: this._paramRead('waves_local_scale'),
        waves_local_windSpeed: this._paramRead('waves_local_windSpeed'),
        waves_local_windDirection: this._paramRead('waves_local_windDirection'),
        waves_local_fetch: this._paramRead('waves_local_fetch'),
        waves_local_spreadBlend: this._paramRead('waves_local_spreadBlend'),
        waves_local_swell: this._paramRead('waves_local_swell'),
        waves_local_peakEnhancement: this._paramRead('waves_local_peakEnhancement'),
        waves_local_shortWavesFade: this._paramRead('waves_local_shortWavesFade'),
        waves_swell_scale: this._paramRead('waves_swell_scale'),
        waves_swell_windSpeed: this._paramRead('waves_swell_windSpeed'),
        waves_swell_windDirection: this._paramRead('waves_swell_windDirection'),
        waves_swell_fetch: this._paramRead('waves_swell_fetch'),
        waves_swell_spreadBlend: this._paramRead('waves_swell_spreadBlend'),
        waves_swell_swell: this._paramRead('waves_swell_swell'),
        waves_swell_peakEnhancement: this._paramRead('waves_swell_peakEnhancement'),
        waves_swell_shortWavesFade: this._paramRead('waves_swell_shortWavesFade'),
      };
      const folder = this._pane.addFolder({ title: 'Waves Generator', expanded: true });
  
      folder
        .addInput(params, 'waves_g', { label: 'Gravity', min: 0.01, max: 30, step: 0.01 })
        .on('change', (ev) => this._paramChanged('waves_g', ev.value));
  
      folder
        .addInput(params, 'waves_depth', { label: 'Depth', min: 0.001, max: 3, step: 0.001 })
        .on('change', (ev) => this._paramChanged('waves_depth', ev.value));
  
      folder
        .addInput(params, 'waves_lambda', { label: 'Lambda', min: 0, max: 1, step: 0.001 })
        .on('change', (ev) => this._paramChanged('waves_lambda', ev.value));
  
      const local = folder.addFolder({ title: 'Local', expanded: true });
      [
        { key: 'waves_local_scale', label: 'Scale', min: 0, max: 1, step: 0.001 },
        { key: 'waves_local_windSpeed', label: 'Wind Speed', min: 0.001, max: 100, step: 0.001 },
        { key: 'waves_local_windDirection', label: 'Wind Dir', min: -100, max: 100, step: 0.1 },
        { key: 'waves_local_fetch', label: 'Fetch', min: 100, max: 1000000, step: 100 },
        { key: 'waves_local_spreadBlend', label: 'Spread Blend', min: 0, max: 1, step: 0.01 },
        { key: 'waves_local_swell', label: 'Swell', min: 0, max: 1, step: 0.01 },
        { key: 'waves_local_peakEnhancement', label: 'Peak Enh', min: 0.01, max: 100, step: 0.01 },
        { key: 'waves_local_shortWavesFade', label: 'Short Fade', min: 0.001, max: 1, step: 0.001 },
      ].forEach((opt) => {
        local
          .addInput(params, opt.key, { label: opt.label, min: opt.min, max: opt.max, step: opt.step })
          .on('change', (ev) => this._paramChanged(opt.key, ev.value));
      });
  
      const swell = folder.addFolder({ title: 'Swell', expanded: true });
      [
        { key: 'waves_swell_scale', label: 'Scale', min: 0, max: 1, step: 0.001 },
        { key: 'waves_swell_windSpeed', label: 'Wind Speed', min: 0.001, max: 100, step: 0.001 },
        { key: 'waves_swell_windDirection', label: 'Wind Dir', min: -100, max: 100, step: 0.1 },
        { key: 'waves_swell_fetch', label: 'Fetch', min: 100, max: 1000000, step: 100 },
        { key: 'waves_swell_spreadBlend', label: 'Spread Blend', min: 0, max: 1, step: 0.01 },
        { key: 'waves_swell_swell', label: 'Swell', min: 0, max: 1, step: 0.01 },
        { key: 'waves_swell_peakEnhancement', label: 'Peak Enh', min: 0.01, max: 100, step: 0.01 },
        { key: 'waves_swell_shortWavesFade', label: 'Short Fade', min: 0.001, max: 1, step: 0.001 },
      ].forEach((opt) => {
        swell
          .addInput(params, opt.key, { label: opt.label, min: opt.min, max: opt.max, step: opt.step })
          .on('change', (ev) => this._paramChanged(opt.key, ev.value));
      });
    }
  
    _makeMenuOceanGeometry() {
      const params = {
        oceangeom_lengthScale: this._paramRead('oceangeom_lengthScale'),
        oceangeom_vertexDensity: this._paramRead('oceangeom_vertexDensity'),
        oceangeom_clipLevels: this._paramRead('oceangeom_clipLevels'),
        oceangeom_skirtSize: this._paramRead('oceangeom_skirtSize')
      };
      const folder = this._pane.addFolder({ title: 'Ocean Geometry', expanded: true });
  
      folder
        .addInput(params, 'oceangeom_lengthScale', { label: 'Length Scale', min: 1, max: 100, step: 0.1 })
        .on('change', (ev) => this._paramChanged('oceangeom_lengthScale', ev.value));
  
      folder
        .addInput(params, 'oceangeom_vertexDensity', { label: 'Vertex Density', min: 1, max: 40, step: 1 })
        .on('change', (ev) => this._paramChanged('oceangeom_vertexDensity', ev.value));
  
      folder
        .addInput(params, 'oceangeom_clipLevels', { label: 'Clip Levels', min: 1, max: 8, step: 1 })
        .on('change', (ev) => this._paramChanged('oceangeom_clipLevels', ev.value));
  
      folder
        .addInput(params, 'oceangeom_skirtSize', { label: 'Skirt Size', min: 0, max: 100, step: 0.1 })
        .on('change', (ev) => this._paramChanged('oceangeom_skirtSize', ev.value));
  
      folder
        .addInput({ wireframe: this._paramRead('oceangeom_wireframe') }, 'wireframe', { label: 'Wireframe' })
        .on('change', (ev) => this._paramChanged('oceangeom_wireframe', ev.value));
  
      folder
        .addInput({ noMaterialLod: this._paramRead('oceangeom_noMaterialLod') }, 'noMaterialLod', { label: 'No Material LOD' })
        .on('change', (ev) => this._paramChanged('oceangeom_noMaterialLod', ev.value));
    }
  
    _makeMenuOceanShader() {
      const params = {
        oceanshader__Color: this._paramRead('oceanshader__Color'),
        oceanshader__MaxGloss: this._paramRead('oceanshader__MaxGloss'),
        oceanshader__RoughnessScale: this._paramRead('oceanshader__RoughnessScale'),
        oceanshader__LOD_scale: this._paramRead('oceanshader__LOD_scale'),
        oceanshader__FoamColor: this._paramRead('oceanshader__FoamColor'),
        oceanshader__FoamScale: this._paramRead('oceanshader__FoamScale'),
        oceanshader__ContactFoam: this._paramRead('oceanshader__ContactFoam'),
        oceanshader__FoamBiasLOD2: this._paramRead('oceanshader__FoamBiasLOD2'),
        oceanshader__SSSColor: this._paramRead('oceanshader__SSSColor'),
        oceanshader__SSSStrength: this._paramRead('oceanshader__SSSStrength'),
        oceanshader__SSSBase: this._paramRead('oceanshader__SSSBase'),
        oceanshader__SSSScale: this._paramRead('oceanshader__SSSScale'),
      };
      const folder = this._pane.addFolder({ title: 'Ocean Shader', expanded: true });
  
      folder
        .addInput(params, 'oceanshader__Color', { label: 'Color', view: 'color' })
        .on('change', (ev) => this._paramChanged('oceanshader__Color', ev.value));
  
      folder
        .addInput(params, 'oceanshader__MaxGloss', { label: 'Max Gloss', min: 0, max: 1, step: 0.01 })
        .on('change', (ev) => this._paramChanged('oceanshader__MaxGloss', ev.value));
  
      folder
        .addInput(params, 'oceanshader__RoughnessScale', { label: 'Roughness', min: 0, max: 1, step: 0.0001 })
        .on('change', (ev) => this._paramChanged('oceanshader__RoughnessScale', ev.value));
  
      folder
        .addInput(params, 'oceanshader__LOD_scale', { label: 'LOD Scale', min: 0.01, max: 20, step: 0.01 })
        .on('change', (ev) => this._paramChanged('oceanshader__LOD_scale', ev.value));
  
      folder
        .addInput(params, 'oceanshader__FoamColor', { label: 'Foam Color', view: 'color' })
        .on('change', (ev) => this._paramChanged('oceanshader__FoamColor', ev.value));
  
      folder
        .addInput(params, 'oceanshader__FoamScale', { label: 'Foam Scale', min: 0.001, max: 8, step: 0.001 })
        .on('change', (ev) => this._paramChanged('oceanshader__FoamScale', ev.value));
  
      folder
        .addInput(params, 'oceanshader__ContactFoam', { label: 'Contact Foam', min: 0.001, max: 3, step: 0.001 })
        .on('change', (ev) => this._paramChanged('oceanshader__ContactFoam', ev.value));
  
      folder
        .addInput(params, 'oceanshader__FoamBiasLOD2', { label: 'Foam Bias', min: 0.001, max: 4, step: 0.001 })
        .on('change', (ev) => this._paramChanged('oceanshader__FoamBiasLOD2', ev.value));
  
      folder
        .addInput(params, 'oceanshader__SSSColor', { label: 'SSS Color', view: 'color' })
        .on('change', (ev) => this._paramChanged('oceanshader__SSSColor', ev.value));
  
      folder
        .addInput(params, 'oceanshader__SSSStrength', { label: 'SSS Strength', min: 0.001, max: 2, step: 0.001 })
        .on('change', (ev) => this._paramChanged('oceanshader__SSSStrength', ev.value));
  
      folder
        .addInput(params, 'oceanshader__SSSBase', { label: 'SSS Base', min: -2, max: 1, step: 0.001 })
        .on('change', (ev) => this._paramChanged('oceanshader__SSSBase', ev.value));
  
      folder
        .addInput(params, 'oceanshader__SSSScale', { label: 'SSS Scale', min: 0.001, max: 10, step: 0.001 })
        .on('change', (ev) => this._paramChanged('oceanshader__SSSScale', ev.value));
    }
  
    _makeMenuBuoyancy() {
      const params = {
        buoy_enabled: this._paramRead('buoy_enabled'),
        buoy_attenuation: this._paramRead('buoy_attenuation'),
        buoy_numSteps: this._paramRead('buoy_numSteps'),
      };
      const folder = this._pane.addFolder({ title: 'Buoyancy', expanded: true });
  
      folder
        .addInput(params, 'buoy_enabled', { label: 'Enabled' })
        .on('change', (ev) => this._paramChanged('buoy_enabled', ev.value));
  
      folder
        .addInput(params, 'buoy_attenuation', { label: 'Damping', min: 0, max: 1, step: 0.001 })
        .on('change', (ev) => this._paramChanged('buoy_attenuation', ev.value));
  
      folder
        .addInput(params, 'buoy_numSteps', { label: 'Num Steps', min: 1, max: 20, step: 1 })
        .on('change', (ev) => this._paramChanged('buoy_numSteps', ev.value));
    }
  }
  