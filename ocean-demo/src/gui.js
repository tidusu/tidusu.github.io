// import { Pane } from "../js/tweakpane.min.js";

class OceanGUI {
    _pane;
    _visible = true;
    _scene;
    _paramRead;
    _paramChanged;
    _onKeyObserver;
    
    // tweakpane.min.js
    static LoadDAT() {
        return true;
        return BABYLON.Tools.LoadScriptAsync("../js/tweakpane.min.js");
    }

    constructor(hasProceduralSky, scene, engine, paramRead, paramChanged) {
      this._scene = scene;
      this._paramRead = paramRead;
      this._paramChanged = paramChanged;
      // 初始化 Tweakpane
      this._pane = new Tweakpane.Pane({
        title: 'Ocean Controls',
        container: document.getElementById('controls-left') || undefined
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
      const folder = this._pane.addFolder({ title: '常规', expanded: true });

      folder
        .addInput(params, 'size', {
          label: '分辨率',
          options: { '256': 256, '128': 128, '64': 64, '32': 32 },
        })
        .on('change', (ev) => this._paramChanged('size', ev.value));

      folder
        .addInput(params, 'envIntensity', { label: '环境强度', min: 0, max: 4, step: 0.05 })
        .on('change', (ev) => this._paramChanged('envIntensity', ev.value));

      folder
        .addInput(params, 'lightIntensity', { label: '光照强度', min: 0, max: 5, step: 0.05 })
        .on('change', (ev) => this._paramChanged('lightIntensity', ev.value));

      [
        { key: 'enableShadows', label: '启用阴影' },
        { key: 'enableGlow', label: '启用辉光' },
        { key: 'useZQSD', label: 'ZQSD 控制' },
        { key: 'showDebugRTT', label: '显示调试RTT' }
      ].forEach(({ key, label }) => {
        folder
          .addInput(params, key, { label })
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
      const folder = this._pane.addFolder({ title: '程序天空', expanded: true });

      folder
        .addInput(params, 'procSky_inclination', { label: '倾斜角', min: -0.5, max: 0.5, step: 0.001 })
        .on('change', (ev) => this._paramChanged('procSky_inclination', ev.value));

      folder
        .addInput(params, 'procSky_azimuth', { label: '方位角', min: 0, max: 1, step: 0.001 })
        .on('change', (ev) => this._paramChanged('procSky_azimuth', ev.value));

      folder
        .addInput(params, 'procSky_luminance', { label: '亮度', min: 0.001, max: 1, step: 0.001 })
        .on('change', (ev) => this._paramChanged('procSky_luminance', ev.value));

      folder
        .addInput(params, 'procSky_turbidity', { label: '浑浊度', min: 0.1, max: 100, step: 0.1 })
        .on('change', (ev) => this._paramChanged('procSky_turbidity', ev.value));

      folder
        .addInput(params, 'procSky_rayleigh', { label: '瑞利散射', min: 0.1, max: 10, step: 0.1 })
        .on('change', (ev) => this._paramChanged('procSky_rayleigh', ev.value));

      folder
        .addInput(params, 'procSky_mieCoefficient', { label: '米氏系数', min: 0, max: 0.1, step: 0.0001 })
        .on('change', (ev) => this._paramChanged('procSky_mieCoefficient', ev.value));

      folder
        .addInput(params, 'procSky_mieDirectionalG', { label: '米氏方向G', min: 0, max: 1, step: 0.01 })
        .on('change', (ev) => this._paramChanged('procSky_mieDirectionalG', ev.value));
    }

    _makeMenuSkybox() {
      const params = {
        skybox_lightColor: this._paramRead('skybox_lightColor'),
        skybox_directionX: this._paramRead('skybox_directionX'),
        skybox_directionY: this._paramRead('skybox_directionY'),
        skybox_directionZ: this._paramRead('skybox_directionZ'),
      };
      const folder = this._pane.addFolder({ title: '天空盒', expanded: true });

      folder
        .addInput(params, 'skybox_lightColor', { label: '光照颜色', view: 'color' })
        .on('change', (ev) => this._paramChanged('skybox_lightColor', ev.value));

      folder
        .addInput(params, 'skybox_directionX', { label: '方向X', min: -10, max: 10, step: 0.001 })
        .on('change', (ev) => this._paramChanged('skybox_directionX', ev.value));

      folder
        .addInput(params, 'skybox_directionY', { label: '方向Y', min: -10, max: -0.01, step: 0.001 })
        .on('change', (ev) => this._paramChanged('skybox_directionY', ev.value));

      folder
        .addInput(params, 'skybox_directionZ', { label: '方向Z', min: -10, max: 10, step: 0.001 })
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
      const folder = this._pane.addFolder({ title: '波浪生成器', expanded: true });
  
      folder
        .addInput(params, 'waves_g', { label: '重力加速度', min: 0.01, max: 30, step: 0.01 })
        .on('change', (ev) => this._paramChanged('waves_g', ev.value));
  
      folder
        .addInput(params, 'waves_depth', { label: '水深', min: 0.001, max: 3, step: 0.001 })
        .on('change', (ev) => this._paramChanged('waves_depth', ev.value));
  
      folder
        .addInput(params, 'waves_lambda', { label: '波长', min: 0, max: 1, step: 0.001 })
        .on('change', (ev) => this._paramChanged('waves_lambda', ev.value));
  
      const local = folder.addFolder({ title: '局部参数', expanded: true });
      [
        { key: 'waves_local_scale', label: '缩放', min: 0, max: 1, step: 0.001 },
        { key: 'waves_local_windSpeed', label: '风速', min: 0.001, max: 100, step: 0.001 },
        { key: 'waves_local_windDirection', label: '风向', min: -100, max: 100, step: 0.1 },
        { key: 'waves_local_fetch', label: '影响距离', min: 100, max: 1000000, step: 100 },
        { key: 'waves_local_spreadBlend', label: '扩散混合', min: 0, max: 1, step: 0.01 },
        { key: 'waves_local_swell', label: '涌浪', min: 0, max: 1, step: 0.01 },
        { key: 'waves_local_peakEnhancement', label: '峰值增强', min: 0.01, max: 100, step: 0.01 },
        { key: 'waves_local_shortWavesFade', label: '短波衰减', min: 0.001, max: 1, step: 0.001 },
      ].forEach((opt) => {
        local
          .addInput(params, opt.key, { label: opt.label, min: opt.min, max: opt.max, step: opt.step })
          .on('change', (ev) => this._paramChanged(opt.key, ev.value));
      });
  
      const swell = folder.addFolder({ title: '涌浪参数', expanded: true });
      [
        { key: 'waves_swell_scale', label: '缩放', min: 0, max: 1, step: 0.001 },
        { key: 'waves_swell_windSpeed', label: '风速', min: 0.001, max: 100, step: 0.001 },
        { key: 'waves_swell_windDirection', label: '风向', min: -100, max: 100, step: 0.1 },
        { key: 'waves_swell_fetch', label: '影响距离', min: 100, max: 1000000, step: 100 },
        { key: 'waves_swell_spreadBlend', label: '扩散混合', min: 0, max: 1, step: 0.01 },
        { key: 'waves_swell_swell', label: '涌浪', min: 0, max: 1, step: 0.01 },
        { key: 'waves_swell_peakEnhancement', label: '峰值增强', min: 0.01, max: 100, step: 0.01 },
        { key: 'waves_swell_shortWavesFade', label: '短波衰减', min: 0.001, max: 1, step: 0.001 },
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
      const folder = this._pane.addFolder({ title: '海洋几何体', expanded: true });
  
      folder
        .addInput(params, 'oceangeom_lengthScale', { label: '长度缩放', min: 1, max: 100, step: 0.1 })
        .on('change', (ev) => this._paramChanged('oceangeom_lengthScale', ev.value));
  
      folder
        .addInput(params, 'oceangeom_vertexDensity', { label: '顶点密度', min: 1, max: 40, step: 1 })
        .on('change', (ev) => this._paramChanged('oceangeom_vertexDensity', ev.value));
  
      folder
        .addInput(params, 'oceangeom_clipLevels', { label: '裁剪层级', min: 1, max: 8, step: 1 })
        .on('change', (ev) => this._paramChanged('oceangeom_clipLevels', ev.value));
  
      folder
        .addInput(params, 'oceangeom_skirtSize', { label: '裙边尺寸', min: 0, max: 100, step: 0.1 })
        .on('change', (ev) => this._paramChanged('oceangeom_skirtSize', ev.value));
  
      folder
        .addInput({ wireframe: this._paramRead('oceangeom_wireframe') }, 'wireframe', { label: '线框模式' })
        .on('change', (ev) => this._paramChanged('oceangeom_wireframe', ev.value));
  
      folder
        .addInput({ noMaterialLod: this._paramRead('oceangeom_noMaterialLod') }, 'noMaterialLod', { label: '无材质LOD' })
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
      const folder = this._pane.addFolder({ title: '海洋着色器', expanded: true });
  
      folder
        .addInput(params, 'oceanshader__Color', { label: '颜色', view: 'color' })
        .on('change', (ev) => this._paramChanged('oceanshader__Color', ev.value));
  
      folder
        .addInput(params, 'oceanshader__MaxGloss', { label: '最大高光', min: 0, max: 1, step: 0.01 })
        .on('change', (ev) => this._paramChanged('oceanshader__MaxGloss', ev.value));
  
      folder
        .addInput(params, 'oceanshader__RoughnessScale', { label: '粗糙度', min: 0, max: 1, step: 0.0001 })
        .on('change', (ev) => this._paramChanged('oceanshader__RoughnessScale', ev.value));
  
      folder
        .addInput(params, 'oceanshader__LOD_scale', { label: 'LOD缩放', min: 0.01, max: 20, step: 0.01 })
        .on('change', (ev) => this._paramChanged('oceanshader__LOD_scale', ev.value));
  
      folder
        .addInput(params, 'oceanshader__FoamColor', { label: '泡沫颜色', view: 'color' })
        .on('change', (ev) => this._paramChanged('oceanshader__FoamColor', ev.value));
  
      folder
        .addInput(params, 'oceanshader__FoamScale', { label: '泡沫缩放', min: 0.001, max: 8, step: 0.001 })
        .on('change', (ev) => this._paramChanged('oceanshader__FoamScale', ev.value));
  
      folder
        .addInput(params, 'oceanshader__ContactFoam', { label: '接触泡沫', min: 0.001, max: 3, step: 0.001 })
        .on('change', (ev) => this._paramChanged('oceanshader__ContactFoam', ev.value));
  
      folder
        .addInput(params, 'oceanshader__FoamBiasLOD2', { label: '泡沫偏置', min: 0.001, max: 4, step: 0.001 })
        .on('change', (ev) => this._paramChanged('oceanshader__FoamBiasLOD2', ev.value));
  
      folder
        .addInput(params, 'oceanshader__SSSColor', { label: '次表面颜色', view: 'color' })
        .on('change', (ev) => this._paramChanged('oceanshader__SSSColor', ev.value));
  
      folder
        .addInput(params, 'oceanshader__SSSStrength', { label: '次表面强度', min: 0.001, max: 2, step: 0.001 })
        .on('change', (ev) => this._paramChanged('oceanshader__SSSStrength', ev.value));
  
      folder
        .addInput(params, 'oceanshader__SSSBase', { label: '次表面基值', min: -2, max: 1, step: 0.001 })
        .on('change', (ev) => this._paramChanged('oceanshader__SSSBase', ev.value));
  
      folder
        .addInput(params, 'oceanshader__SSSScale', { label: '次表面缩放', min: 0.001, max: 10, step: 0.001 })
        .on('change', (ev) => this._paramChanged('oceanshader__SSSScale', ev.value));
    }
  
    _makeMenuBuoyancy() {
      const params = {
        buoy_enabled: this._paramRead('buoy_enabled'),
        buoy_attenuation: this._paramRead('buoy_attenuation'),
        buoy_numSteps: this._paramRead('buoy_numSteps'),
      };
      const folder = this._pane.addFolder({ title: '浮力', expanded: true });
  
      folder
        .addInput(params, 'buoy_enabled', { label: '启用' })
        .on('change', (ev) => this._paramChanged('buoy_enabled', ev.value));
  
      folder
        .addInput(params, 'buoy_attenuation', { label: '阻尼', min: 0, max: 1, step: 0.001 })
        .on('change', (ev) => this._paramChanged('buoy_attenuation', ev.value));
  
      folder
        .addInput(params, 'buoy_numSteps', { label: '步数', min: 1, max: 20, step: 1 })
        .on('change', (ev) => this._paramChanged('buoy_numSteps', ev.value));
    }
  }
  