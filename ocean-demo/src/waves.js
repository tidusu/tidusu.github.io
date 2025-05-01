class WavesSettings {
    g = 9.81;
    depth = 3;
    //[Range(0, 1)]
    lambda = 1;
    local = {
        scale: 0.5,
        windSpeed: 1.5,
        windDirection: -29.81,
        fetch: 100000,
        spreadBlend: 1,
        swell: 0.198,
        peakEnhancement: 3.3,
        shortWavesFade: 0.01,
    };
    swell = {
        scale: 0.5,
        windSpeed: 1.5,
        windDirection: 90,
        fetch: 300000,
        spreadBlend: 1,
        swell: 1,
        peakEnhancement: 3.3,
        shortWavesFade: 0.01,
    };
    spectrums = [{
        scale: 0,
        angle: 0,
        spreadBlend: 0,
        swell: 0,
        alpha: 0,
        peakOmega: 0,
        gamma: 0,
        shortWavesFade: 0,
    }, {
        scale: 0,
        angle: 0,
        spreadBlend: 0,
        swell: 0,
        alpha: 0,
        peakOmega: 0,
        gamma: 0,
        shortWavesFade: 0,
    }];
    setParametersToShader(params, spectrumParameters) {
        params.updateFloat("GravityAcceleration", this.g);
        params.updateFloat("Depth", this.depth);
        this._fillSettingsStruct(this.local, this.spectrums[0]);
        this._fillSettingsStruct(this.swell, this.spectrums[1]);
        const buffer = [];
        this._linearizeSpectrumSetting(this.spectrums[0], buffer);
        this._linearizeSpectrumSetting(this.spectrums[1], buffer);
        spectrumParameters.update(buffer);
    }
    _linearizeSpectrumSetting(spectrum, buffer) {
        buffer.push(spectrum.scale, spectrum.angle, spectrum.spreadBlend, spectrum.swell, spectrum.alpha, spectrum.peakOmega, spectrum.gamma, spectrum.shortWavesFade);
    }
    _fillSettingsStruct(display, settings) {
        settings.scale = display.scale;
        settings.angle = display.windDirection / 180 * Math.PI;
        settings.spreadBlend = display.spreadBlend;
        settings.swell = BABYLON.Scalar.Clamp(display.swell, 0.01, 1);
        settings.alpha = this._JonswapAlpha(this.g, display.fetch, display.windSpeed);
        settings.peakOmega = this._JonswapPeakFrequency(this.g, display.fetch, display.windSpeed);
        settings.gamma = display.peakEnhancement;
        settings.shortWavesFade = display.shortWavesFade;
    }
    _JonswapAlpha(g, fetch, windSpeed) {
        return 0.076 * Math.pow(g * fetch / windSpeed / windSpeed, -0.22);
    }
    _JonswapPeakFrequency(g, fetch, windSpeed) {
        return 22 * Math.pow(windSpeed * fetch / g / g, -0.33);
    }
}
class WavesGenerator {
    lengthScale;
    _engine;
    _startTime;
    _rttDebug;
    _fft;
    _noise;
    _cascades;
    _displacementMap;
    _wavesSettings;
    getCascade(num) {
        return this._cascades[num];
    }
    get waterHeightMap() {
        return this._displacementMap;
    }
    get waterHeightMapScale() {
        return this.lengthScale[0];
    }
    constructor(size, wavesSettings, scene, rttDebug, noise) {
        this._engine = scene.getEngine();
        this._rttDebug = rttDebug;
        this._startTime = new Date().getTime() / 1000;
        this._displacementMap = null;
        this._wavesSettings = wavesSettings;
        this._fft = new FFT(scene.getEngine(), scene, this._rttDebug, 1, size);
        this._noise = this._generateNoiseTexture(size, noise);
        this._rttDebug.setTexture(0, "noise", this._noise);
        this.lengthScale = [250, 17, 5];
        this._cascades = [
            new WavesCascade(size, this._noise, this._fft, this._rttDebug, 2, this._engine),
            new WavesCascade(size, this._noise, this._fft, this._rttDebug, 12, this._engine),
            new WavesCascade(size, this._noise, this._fft, this._rttDebug, 22, this._engine),
        ];
    }
    async initAsync() {
        await this._fft.initAsync();
        for (let i = 0; i < this._cascades.length; ++i) {
            const cascade = this._cascades[i];
            await cascade.initAsync();
        }
        this.initializeCascades();
    }
    initializeCascades() {
        let boundary1 = 0.0001;
        for (let i = 0; i < this.lengthScale.length; ++i) {
            let boundary2 = i < this.lengthScale.length - 1 ? 2 * Math.PI / this.lengthScale[i + 1] * 6 : 9999;
            this._cascades[i].calculateInitials(this._wavesSettings, this.lengthScale[i], boundary1, boundary2);
            boundary1 = boundary2;
        }
    }
    update() {
        const time = (new Date().getTime() / 1000) - this._startTime;
        for (let i = 0; i < this._cascades.length; ++i) {
            this._cascades[i].calculateWavesAtTime(time);
        }
        this._getDisplacementMap();
    }
    dispose() {
        for (let i = 0; i < this._cascades.length; ++i) {
            this._cascades[i].dispose();
        }
        this._noise.dispose();
        this._fft.dispose();
    }
    _getDisplacementMap() {
        this._cascades[0].displacement.readPixels(undefined, undefined, undefined, undefined, true)?.then((buffer) => {
            this._displacementMap = new Uint16Array(buffer.buffer);
        });
    }
    _normalRandom() {
        return Math.cos(2 * Math.PI * Math.random()) * Math.sqrt(-2 * Math.log(Math.random()));
    }
    _generateNoiseTexture(size, noiseBuffer) {
        const numChannels = noiseBuffer ? 4 : 2;
        const data = new Float32Array(size * size * numChannels);
        if (noiseBuffer) {
            const buf = new Uint8Array(noiseBuffer);
            const tmpUint8 = new Uint8Array(4);
            const tmpFloat = new Float32Array(tmpUint8.buffer, 0, 1);
            let offset = 0x094b;
            let dataOffset = 0;
            for (let j = 0; j < 256; ++j) {
                offset += 8;
                offset += 256 * 4; // A channel
                offset += 256 * 4; // B channel
                for (let i = 0; i < 256; ++i) { // G channel
                    tmpUint8[0] = buf[offset++];
                    tmpUint8[1] = buf[offset++];
                    tmpUint8[2] = buf[offset++];
                    tmpUint8[3] = buf[offset++];
                    data[dataOffset + 1 + i * 4] = tmpFloat[0];
                }
                for (let i = 0; i < 256; ++i) { // R channel
                    tmpUint8[0] = buf[offset++];
                    tmpUint8[1] = buf[offset++];
                    tmpUint8[2] = buf[offset++];
                    tmpUint8[3] = buf[offset++];
                    data[dataOffset + 0 + i * 4] = tmpFloat[0];
                }
                for (let i = 0; i < 256; ++i) { // A channel
                    data[dataOffset + 3 + i * 4] = 1;
                }
                dataOffset += 256 * 4;
            }
        }
        else {
            for (let i = 0; i < size; ++i) {
                for (let j = 0; j < size; ++j) {
                    data[j * size * 2 + i * 2 + 0] = this._normalRandom();
                    data[j * size * 2 + i * 2 + 1] = this._normalRandom();
                }
            }
        }
        const noise = new BABYLON.RawTexture(data, size, size, numChannels === 2 ? BABYLON.Constants.TEXTUREFORMAT_RG : BABYLON.Constants.TEXTUREFORMAT_RGBA, this._engine, false, false, BABYLON.Constants.TEXTURE_NEAREST_SAMPLINGMODE, BABYLON.Constants.TEXTURETYPE_FLOAT);
        noise.name = "noise";
        return noise;
    }
}
class WavesCascade {
    _engine;
    _size;
    _fft;
    _initialSpectrum;
    _lambda;
    _timeDependentSpectrum;
    _timeDependentSpectrumParams;
    _buffer;
    _DxDz;
    _DyDxz;
    _DyxDyz;
    _DxxDzz;
    _texturesMerger;
    _texturesMergerParams;
    _displacement;
    _derivatives;
    _turbulence;
    _turbulence2;
    _pingPongTurbulence;
    get displacement() {
        return this._displacement;
    }
    get derivatives() {
        return this._derivatives;
    }
    get turbulence() {
        return this._pingPongTurbulence ? this._turbulence2 : this._turbulence;
    }
    constructor(size, gaussianNoise, fft, rttDebug, debugFirstIndex, engine) {
        this._engine = engine;
        this._size = size;
        this._fft = fft;
        this._lambda = 0;
        this._pingPongTurbulence = false;
        this._initialSpectrum = new InitialSpectrum(engine, rttDebug, debugFirstIndex, size, gaussianNoise);
        this._timeDependentSpectrum = new BABYLON.ComputeShader("timeDependentSpectrumCS", this._engine, { computeSource: timeDependentSpectrumCS }, {
            bindingsMapping: {
                "H0": { group: 0, binding: 1 },
                "WavesData": { group: 0, binding: 3 },
                "params": { group: 0, binding: 4 },
                "DxDz": { group: 0, binding: 5 },
                "DyDxz": { group: 0, binding: 6 },
                "DyxDyz": { group: 0, binding: 7 },
                "DxxDzz": { group: 0, binding: 8 },
            },
            entryPoint: "calculateAmplitudes"
        });
        this._buffer = ComputeHelper.CreateStorageTexture("buffer", this._engine, this._size, this._size, BABYLON.Constants.TEXTUREFORMAT_RG);
        this._DxDz = ComputeHelper.CreateStorageTexture("DxDz", this._engine, this._size, this._size, BABYLON.Constants.TEXTUREFORMAT_RG);
        this._DyDxz = ComputeHelper.CreateStorageTexture("DyDxz", this._engine, this._size, this._size, BABYLON.Constants.TEXTUREFORMAT_RG);
        this._DyxDyz = ComputeHelper.CreateStorageTexture("DyxDyz", this._engine, this._size, this._size, BABYLON.Constants.TEXTUREFORMAT_RG);
        this._DxxDzz = ComputeHelper.CreateStorageTexture("DxxDzz", this._engine, this._size, this._size, BABYLON.Constants.TEXTUREFORMAT_RG);
        this._timeDependentSpectrumParams = new BABYLON.UniformBuffer(this._engine);
        this._timeDependentSpectrumParams.addUniform("Time", 1);
        this._timeDependentSpectrum.setTexture("H0", this._initialSpectrum.initialSpectrum, false);
        this._timeDependentSpectrum.setTexture("WavesData", this._initialSpectrum.wavesData, false);
        this._timeDependentSpectrum.setUniformBuffer("params", this._timeDependentSpectrumParams);
        this._timeDependentSpectrum.setStorageTexture("DxDz", this._DxDz);
        this._timeDependentSpectrum.setStorageTexture("DyDxz", this._DyDxz);
        this._timeDependentSpectrum.setStorageTexture("DyxDyz", this._DyxDyz);
        this._timeDependentSpectrum.setStorageTexture("DxxDzz", this._DxxDzz);
        rttDebug.setTexture(debugFirstIndex + 3, "DxDz", this._DxDz, 2);
        rttDebug.setTexture(debugFirstIndex + 4, "DyDxz", this._DyDxz, 2);
        rttDebug.setTexture(debugFirstIndex + 5, "DyxDyz", this._DyxDyz, 2);
        rttDebug.setTexture(debugFirstIndex + 6, "DxxDzz", this._DxxDzz, 2);
        //rttDebug.setTexture(debugFirstIndex + 7, "buffer", this._buffer, 2);
        this._texturesMerger = new BABYLON.ComputeShader("texturesMerger", this._engine, { computeSource: wavesTexturesMergerCS }, {
            bindingsMapping: {
                "params": { group: 0, binding: 0 },
                "Displacement": { group: 0, binding: 1 },
                "Derivatives": { group: 0, binding: 2 },
                "TurbulenceRead": { group: 0, binding: 3 },
                "TurbulenceWrite": { group: 0, binding: 4 },
                "DxDz": { group: 0, binding: 5 },
                "DyDxz": { group: 0, binding: 6 },
                "DyxDyz": { group: 0, binding: 7 },
                "DxxDzz": { group: 0, binding: 8 },
            },
            entryPoint: "fillResultTextures"
        });
        this._displacement = ComputeHelper.CreateStorageTexture("displacement", this._engine, this._size, this._size, BABYLON.Constants.TEXTUREFORMAT_RGBA, BABYLON.Constants.TEXTURETYPE_HALF_FLOAT, BABYLON.Constants.TEXTURE_BILINEAR_SAMPLINGMODE);
        this._derivatives = ComputeHelper.CreateStorageTexture("derivatives", this._engine, this._size, this._size, BABYLON.Constants.TEXTUREFORMAT_RGBA, BABYLON.Constants.TEXTURETYPE_HALF_FLOAT, BABYLON.Constants.TEXTURE_TRILINEAR_SAMPLINGMODE, true);
        this._turbulence = ComputeHelper.CreateStorageTexture("turbulence", this._engine, this._size, this._size, BABYLON.Constants.TEXTUREFORMAT_RGBA, BABYLON.Constants.TEXTURETYPE_HALF_FLOAT, BABYLON.Constants.TEXTURE_TRILINEAR_SAMPLINGMODE, true);
        this._turbulence2 = ComputeHelper.CreateStorageTexture("turbulence", this._engine, this._size, this._size, BABYLON.Constants.TEXTUREFORMAT_RGBA, BABYLON.Constants.TEXTURETYPE_HALF_FLOAT, BABYLON.Constants.TEXTURE_TRILINEAR_SAMPLINGMODE, true);
        this._texturesMergerParams = new BABYLON.UniformBuffer(this._engine);
        this._texturesMergerParams.addUniform("Lambda", 1);
        this._texturesMergerParams.addUniform("DeltaTime", 1);
        this._texturesMerger.setUniformBuffer("params", this._texturesMergerParams);
        this._texturesMerger.setStorageTexture("Displacement", this._displacement);
        this._texturesMerger.setStorageTexture("Derivatives", this._derivatives);
        this._texturesMerger.setTexture("DxDz", this._DxDz, false);
        this._texturesMerger.setTexture("DyDxz", this._DyDxz, false);
        this._texturesMerger.setTexture("DyxDyz", this._DyxDyz, false);
        this._texturesMerger.setTexture("DxxDzz", this._DxxDzz, false);
        rttDebug.setTexture(debugFirstIndex + 7, "displacement", this._displacement, 2);
        rttDebug.setTexture(debugFirstIndex + 8, "derivatives", this._derivatives, 2);
        rttDebug.setTexture(debugFirstIndex + 9, "turbulence", this._turbulence, 1);
    }
    async initAsync() {
        await this._initialSpectrum.initAsync();
        const allCS = [];
        allCS.push(this._timeDependentSpectrum);
        allCS.push(this._texturesMerger);
        await ComputeHelper.CheckForComputeShadersReadiness(allCS);
    }
    calculateInitials(wavesSettings, lengthScale, cutoffLow, cutoffHigh) {
        this._lambda = wavesSettings.lambda;
        this._initialSpectrum.generate(wavesSettings, lengthScale, cutoffLow, cutoffHigh);
    }
    calculateWavesAtTime(time) {
        // Calculating complex amplitudes
        this._timeDependentSpectrumParams.updateFloat("Time", time);
        this._timeDependentSpectrumParams.update();
        ComputeHelper.Dispatch(this._timeDependentSpectrum, this._size, this._size, 1);
        // Calculating IFFTs of complex amplitudes
        this._fft.IFFT2D(this._DxDz, this._buffer);
        this._fft.IFFT2D(this._DyDxz, this._buffer);
        this._fft.IFFT2D(this._DyxDyz, this._buffer);
        this._fft.IFFT2D(this._DxxDzz, this._buffer);
        // Filling displacement and normals textures
        let deltaTime = this._engine.getDeltaTime() / 1000;
        if (deltaTime > 0.5) {
            // avoid too big delta time
            deltaTime = 0.5;
        }
        this._texturesMergerParams.updateFloat("Lambda", this._lambda);
        this._texturesMergerParams.updateFloat("DeltaTime", deltaTime);
        this._texturesMergerParams.update();
        this._pingPongTurbulence = !this._pingPongTurbulence;
        this._texturesMerger.setTexture("TurbulenceRead", this._pingPongTurbulence ? this._turbulence : this._turbulence2, false);
        this._texturesMerger.setStorageTexture("TurbulenceWrite", this._pingPongTurbulence ? this._turbulence2 : this._turbulence);
        ComputeHelper.Dispatch(this._texturesMerger, this._size, this._size, 1);
        this._engine.generateMipmaps(this._derivatives.getInternalTexture());
        this._engine.generateMipmaps(this._pingPongTurbulence ? this._turbulence2.getInternalTexture() : this._turbulence.getInternalTexture());
    }
    dispose() {
        this._initialSpectrum.dispose();
        this._timeDependentSpectrumParams.dispose();
        this._buffer.dispose();
        this._DxDz.dispose();
        this._DyDxz.dispose();
        this._DyxDyz.dispose();
        this._DxxDzz.dispose();
        this._texturesMergerParams.dispose();
    }
}
