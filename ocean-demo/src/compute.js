
class InitialSpectrum {
    _engine;
    _rttDebug;
    _debugFirstIndex;
    _textureSize;
    _phase1;
    _spectrumParameters;
    _params;
    _precomputedData;
    _buffer;
    _phase2;
    _initialSpectrum;
    get initialSpectrum() {
        return this._initialSpectrum;
    }
    get wavesData() {
        return this._precomputedData;
    }
    constructor(engine, rttDebug, debugFirstIndex, textureSize, noise) {
        this._engine = engine;
        this._rttDebug = rttDebug;
        this._debugFirstIndex = debugFirstIndex;
        this._textureSize = textureSize;
        this._phase1 = new BABYLON.ComputeShader("initialSpectrum", this._engine, { computeSource: initialSpectrumCS }, {
            bindingsMapping: {
                "WavesData": { group: 0, binding: 1 },
                "H0K": { group: 0, binding: 2 },
                "Noise": { group: 0, binding: 4 },
                "params": { group: 0, binding: 5 },
                "spectrumParameters": { group: 0, binding: 6 },
            },
            entryPoint: "calculateInitialSpectrum"
        });
        this._initialSpectrum = ComputeHelper.CreateStorageTexture("h0", engine, textureSize, textureSize, BABYLON.Constants.TEXTUREFORMAT_RGBA);
        this._precomputedData = ComputeHelper.CreateStorageTexture("wavesData", engine, textureSize, textureSize, BABYLON.Constants.TEXTUREFORMAT_RGBA);
        this._buffer = ComputeHelper.CreateStorageTexture("h0k", engine, textureSize, textureSize, BABYLON.Constants.TEXTUREFORMAT_RG);
        this._spectrumParameters = new BABYLON.StorageBuffer(this._engine, 8 * 2 * 4, BABYLON.Constants.BUFFER_CREATIONFLAG_READWRITE);
        this._params = new BABYLON.UniformBuffer(this._engine);
        this._params.addUniform("Size", 1);
        this._params.addUniform("LengthScale", 1);
        this._params.addUniform("CutoffHigh", 1);
        this._params.addUniform("CutoffLow", 1);
        this._params.addUniform("GravityAcceleration", 1);
        this._params.addUniform("Depth", 1);
        this._phase1.setStorageTexture("WavesData", this._precomputedData);
        this._phase1.setStorageTexture("H0K", this._buffer);
        this._phase1.setTexture("Noise", noise, false);
        this._phase1.setStorageBuffer("spectrumParameters", this._spectrumParameters);
        this._phase1.setUniformBuffer("params", this._params);
        this._phase2 = new BABYLON.ComputeShader("initialSpectrum2", this._engine, { computeSource: initialSpectrum2CS }, {
            bindingsMapping: {
                "H0": { group: 0, binding: 0 },
                "params": { group: 0, binding: 5 },
                "H0K": { group: 0, binding: 8 },
            },
            entryPoint: "calculateConjugatedSpectrum"
        });
        this._phase2.setStorageTexture("H0", this._initialSpectrum);
        this._phase2.setUniformBuffer("params", this._params);
        this._phase2.setTexture("H0K", this._buffer, false);
        this._rttDebug.setTexture(this._debugFirstIndex + 0, "waves precompute", this._precomputedData);
        this._rttDebug.setTexture(this._debugFirstIndex + 1, "H0K", this._buffer, 1000);
        this._rttDebug.setTexture(this._debugFirstIndex + 2, "H0", this._initialSpectrum, 1000);
    }
    async initAsync() {
        const allCS = [];
        allCS.push(this._phase1);
        allCS.push(this._phase2);
        await ComputeHelper.CheckForComputeShadersReadiness(allCS);
    }
    generate(wavesSettings, lengthScale, cutoffLow, cutoffHigh) {
        this._params.updateInt("Size", this._textureSize);
        this._params.updateFloat("LengthScale", lengthScale);
        this._params.updateFloat("CutoffHigh", cutoffHigh);
        this._params.updateFloat("CutoffLow", cutoffLow);
        wavesSettings.setParametersToShader(this._params, this._spectrumParameters);
        this._params.update();
        ComputeHelper.Dispatch(this._phase1, this._textureSize, this._textureSize, 1);
        ComputeHelper.Dispatch(this._phase2, this._textureSize, this._textureSize, 1);
    }
    dispose() {
        this._spectrumParameters.dispose();
        this._params.dispose();
        this._precomputedData.dispose();
        this._buffer.dispose();
        this._initialSpectrum.dispose();
        this._phase1 = null;
        this._phase2 = null;
    }
}
class FFT {
    _engine;
    _rttDebug;
    _debugFirstIndex;
    _size;
    _precomputedData;
    _params;
    _horizontalStepIFFT;
    _verticalStepIFFT;
    _permute;
    _computeTwiddleFactors;
    constructor(engine, scene, rttDebug, debugFirstIndex, size) {
        this._engine = engine;
        this._rttDebug = rttDebug;
        this._debugFirstIndex = debugFirstIndex;
        this._size = size;
        this._horizontalStepIFFT = [];
        this._verticalStepIFFT = [];
        this._permute = null;
        const cs = new BABYLON.ComputeShader("computeTwiddleFactors", this._engine, { computeSource: fftPrecomputeCS }, {
            bindingsMapping: {
                "PrecomputeBuffer": { group: 0, binding: 0 },
                "params": { group: 0, binding: 1 },
            },
            entryPoint: "precomputeTwiddleFactorsAndInputIndices"
        });
        this._computeTwiddleFactors = cs;
        const logSize = Math.log2(size) | 0;
        this._precomputedData = ComputeHelper.CreateStorageTexture("precomputeTwiddle", this._engine, logSize, this._size, BABYLON.Constants.TEXTUREFORMAT_RGBA);
        this._rttDebug.setTexture(this._debugFirstIndex, "precomputeTwiddle", this._precomputedData);
        this._params = new BABYLON.UniformBuffer(this._engine);
        this._params.addUniform("Step", 1);
        this._params.addUniform("Size", 1);
        cs.setStorageTexture("PrecomputeBuffer", this._precomputedData);
        cs.setUniformBuffer("params", this._params);
        this._params.updateInt("Size", this._size);
        this._params.update();
        this._createComputeShaders();
    }
    async initAsync() {
        const logSize = Math.log2(this._size) | 0;
        await ComputeHelper.DispatchWhenReady(this._computeTwiddleFactors, logSize, this._size / 2, 1);
        const allCS = [];
        this._horizontalStepIFFT.forEach((cs) => allCS.push(cs));
        this._verticalStepIFFT.forEach((cs) => allCS.push(cs));
        allCS.push(this._permute);
        await ComputeHelper.CheckForComputeShadersReadiness(allCS);
    }
    IFFT2D(input, buffer) {
        const logSize = Math.log2(this._size) | 0;
        // TODO: optimize recreation of binding groups by not ping/ponging the textures
        /*this._horizontalStepIFFT[0].setTexture("InputBuffer", input, false);
        this._horizontalStepIFFT[0].setStorageTexture("OutputBuffer", buffer);
        this._horizontalStepIFFT[1].setTexture("InputBuffer", buffer, false);
        this._horizontalStepIFFT[1].setStorageTexture("OutputBuffer", input);*/
        let pingPong = false;
        for (let i = 0; i < logSize; ++i) {
            pingPong = !pingPong;
            this._params.updateInt("Step", i);
            this._params.update();
            this._horizontalStepIFFT[0].setTexture("InputBuffer", pingPong ? input : buffer, false);
            this._horizontalStepIFFT[0].setStorageTexture("OutputBuffer", pingPong ? buffer : input);
            ComputeHelper.Dispatch(this._horizontalStepIFFT[0], this._size, this._size, 1);
            //ComputeHelper.Dispatch(pingPong ? this._horizontalStepIFFT[0] : this._horizontalStepIFFT[1], this._size, this._size, 1);
        }
        /*this._verticalStepIFFT[0].setTexture("InputBuffer", pingPong ? buffer : input, false);
        this._verticalStepIFFT[0].setStorageTexture("OutputBuffer", pingPong ? input : buffer);
        this._verticalStepIFFT[1].setTexture("InputBuffer", pingPong ? input : buffer, false);
        this._verticalStepIFFT[1].setStorageTexture("OutputBuffer", pingPong ? buffer : input);*/
        for (let i = 0; i < logSize; ++i) {
            pingPong = !pingPong;
            this._params.updateInt("Step", i);
            this._params.update();
            this._verticalStepIFFT[0].setTexture("InputBuffer", pingPong ? input : buffer, false);
            this._verticalStepIFFT[0].setStorageTexture("OutputBuffer", pingPong ? buffer : input);
            ComputeHelper.Dispatch(this._verticalStepIFFT[0], this._size, this._size, 1);
            //ComputeHelper.Dispatch(pingPong ? this._verticalStepIFFT[0] : this._verticalStepIFFT[1], this._size, this._size, 1);
        }
        if (pingPong) {
            ComputeHelper.CopyTexture(buffer, input, this._engine);
        }
        this._permute.setTexture("InputBuffer", input, false);
        this._permute.setStorageTexture("OutputBuffer", buffer);
        ComputeHelper.Dispatch(this._permute, this._size, this._size, 1);
        ComputeHelper.CopyTexture(buffer, input, this._engine);
    }
    dispose() {
        this._precomputedData.dispose();
        this._params.dispose();
    }
    _createComputeShaders() {
        for (let i = 0; i < 2; ++i) {
            this._horizontalStepIFFT[i] = new BABYLON.ComputeShader("horizontalStepIFFT", this._engine, { computeSource: fftInverseFFTCS }, {
                bindingsMapping: {
                    "params": { group: 0, binding: 1 },
                    "PrecomputedData": { group: 0, binding: 3 },
                    "InputBuffer": { group: 0, binding: 5 },
                    "OutputBuffer": { group: 0, binding: 6 },
                },
                entryPoint: "horizontalStepInverseFFT"
            });
            this._horizontalStepIFFT[i].setUniformBuffer("params", this._params);
            this._horizontalStepIFFT[i].setTexture("PrecomputedData", this._precomputedData, false);
            this._verticalStepIFFT[i] = new BABYLON.ComputeShader("verticalStepIFFT", this._engine, { computeSource: fftInverseFFT2CS }, {
                bindingsMapping: {
                    "params": { group: 0, binding: 1 },
                    "PrecomputedData": { group: 0, binding: 3 },
                    "InputBuffer": { group: 0, binding: 5 },
                    "OutputBuffer": { group: 0, binding: 6 },
                },
                entryPoint: "verticalStepInverseFFT"
            });
            this._verticalStepIFFT[i].setUniformBuffer("params", this._params);
            this._verticalStepIFFT[i].setTexture("PrecomputedData", this._precomputedData, false);
        }
        this._permute = new BABYLON.ComputeShader("permute", this._engine, { computeSource: fftInverseFFT3CS }, {
            bindingsMapping: {
                "InputBuffer": { group: 0, binding: 5 },
                "OutputBuffer": { group: 0, binding: 6 },
            },
            entryPoint: "permute"
        });
    }
}
class ComputeHelper {
    static _copyTexture4CS;
    static _copyTexture2CS;
    static _copyTexture4Params;
    static _copyTexture2Params;
    static _copyBufferTextureCS;
    static _copyBufferTextureParams;
    static _copyTextureBufferCS;
    static _copyTextureBufferParams;
    static _clearTextureCS;
    static _clearTextureParams;
    static _clearTextureComputeShader = `
    @group(0) @binding(0) var tbuf : texture_storage_2d<rgba32float, write>;

    struct Params {
        color : vec4<f32>,
        width : u32,
        height : u32,
    };
    @group(0) @binding(1) var<uniform> params : Params;

    @compute @workgroup_size(8, 8, 1)
    fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
        if (global_id.x >= params.width || global_id.y >= params.height) {
            return;
        }
        textureStore(tbuf, vec2<i32>(global_id.xy), params.color);
    }
`;
    static _copyTexture4ComputeShader = `
    @group(0) @binding(0) var dest : texture_storage_2d<rgba32float, write>;
    @group(0) @binding(1) var src : texture_2d<f32>;

    struct Params {
        width : u32,
        height : u32,
    };
    @group(0) @binding(2) var<uniform> params : Params;

    @compute @workgroup_size(8, 8, 1)
    fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
        if (global_id.x >= params.width || global_id.y >= params.height) {
            return;
        }
        let pix : vec4<f32> = textureLoad(src, vec2<i32>(global_id.xy), 0);
        textureStore(dest, vec2<i32>(global_id.xy), pix);
    }
`;
    static _copyTexture2ComputeShader = `
    @group(0) @binding(0) var dest : texture_storage_2d<rg32float, write>;
    @group(0) @binding(1) var src : texture_2d<f32>;

    struct Params {
        width : u32,
        height : u32,
    };
    @group(0) @binding(2) var<uniform> params : Params;

    @compute @workgroup_size(8, 8, 1)
    fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
        if (global_id.x >= params.width || global_id.y >= params.height) {
            return;
        }
        let pix : vec4<f32> = textureLoad(src, vec2<i32>(global_id.xy), 0);
        textureStore(dest, vec2<i32>(global_id.xy), pix);
    }
`;
    static _copyBufferTextureComputeShader = `
    struct FloatArray {
        elements : array<f32>,
    };

    @group(0) @binding(0) var dest : texture_storage_2d<rgba32float, write>;
    @group(0) @binding(1) var<storage, read> src : FloatArray;

    struct Params {
        width : u32,
        height : u32,
    };
    @group(0) @binding(2) var<uniform> params : Params;

    @compute @workgroup_size(8, 8, 1)
    fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
        if (global_id.x >= params.width || global_id.y >= params.height) {
            return;
        }
        let offset : u32 = global_id.y * params.width * 4u + global_id.x * 4u;
        let pix : vec4<f32> = vec4<f32>(src.elements[offset], src.elements[offset + 1u], src.elements[offset + 2u], src.elements[offset + 3u]);
        textureStore(dest, vec2<i32>(global_id.xy), pix);
    }
`;
    static _copyTextureBufferComputeShader = `
    struct FloatArray {
        elements : array<f32>,
    };

    @group(0) @binding(0) var src : texture_2d<f32>;
    @group(0) @binding(1) var<storage, write> dest : FloatArray;

    struct Params {
        width : u32,
        height : u32,
    };
    @group(0) @binding(2) var<uniform> params : Params;

    @compute, workgroup_size(8, 8, 1)
    fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
        if (global_id.x >= params.width || global_id.y >= params.height) {
            return;
        }
        let offset : u32 = global_id.y * params.width * 4u + global_id.x * 4u;
        let pix : vec4<f32> = textureLoad(src, vec2<i32>(global_id.xy), 0);
        dest.elements[offset] = pix.r;
        dest.elements[offset + 1u] = pix.g;
        dest.elements[offset + 2u] = pix.b;
        dest.elements[offset + 3u] = pix.a;
    }
`;
    static GetThreadGroupSizes(source, entryPoint) {
        const rx = new RegExp(`workgroup_size\\s*\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*\\)\\s*fn\\s+${entryPoint}\\s*\\(`, "g");
        const res = rx.exec(source);
        return res ? new BABYLON.Vector3(parseInt(res[1]), parseInt(res[2]), parseInt(res[3])) : new BABYLON.Vector3(1, 1, 1);
    }
    static CreateStorageTexture(name, sceneOrEngine, nwidth, nheight, textureFormat = BABYLON.Constants.TEXTUREFORMAT_RGBA, textureType = BABYLON.Constants.TEXTURETYPE_FLOAT, filterMode = BABYLON.Constants.TEXTURE_NEAREST_SAMPLINGMODE, generateMipMaps = false, wrapMode = BABYLON.Constants.TEXTURE_WRAP_ADDRESSMODE, texture = null) {
        const { width, height } = texture ? texture.getSize() : { width: 0, height: 0 };
        let type = texture ? (texture.getInternalTexture().type ?? -1) : -2;
        let format = texture ? (texture.getInternalTexture().format ?? -1) : -2;
        if (type === -1) {
            type = BABYLON.Constants.TEXTURETYPE_UNSIGNED_BYTE;
        }
        if (format === -1) {
            format = BABYLON.Constants.TEXTUREFORMAT_RGBA;
        }
        if (!texture || width !== nwidth || height !== nheight || textureType !== type || textureFormat !== format) {
            /*texture = new BABYLON.RenderTargetTexture(name, { width: nwidth, height: nheight }, scene, false, undefined, textureType, false, filterMode, false, false, false,
                textureFormat, false, undefined, BABYLON.Constants.TEXTURE_CREATIONFLAG_STORAGE);*/
            texture = new BABYLON.RawTexture(null, nwidth, nheight, textureFormat, sceneOrEngine, generateMipMaps, false, filterMode, textureType, BABYLON.Constants.TEXTURE_CREATIONFLAG_STORAGE);
            texture.name = name;
        }
        texture.wrapU = wrapMode;
        texture.wrapV = wrapMode;
        texture.updateSamplingMode(filterMode);
        return texture;
    }
    static CopyTexture(source, dest, engine_) {
        const numChannels = source.getInternalTexture().format === BABYLON.Constants.TEXTUREFORMAT_RG ? 2 : 4;
        if (!ComputeHelper._copyTexture4CS && numChannels === 4 || !ComputeHelper._copyTexture2CS && numChannels === 2) {
            const engine = source.getScene()?.getEngine() ?? engine_;
            const cs1 = new BABYLON.ComputeShader(`copyTexture${numChannels}Compute`, engine, { computeSource: numChannels === 4 ? ComputeHelper._copyTexture4ComputeShader : ComputeHelper._copyTexture2ComputeShader }, {
                bindingsMapping: {
                    "dest": { group: 0, binding: 0 },
                    "src": { group: 0, binding: 1 },
                    "params": { group: 0, binding: 2 },
                }
            });
            const uBuffer0 = new BABYLON.UniformBuffer(engine);
            uBuffer0.addUniform("width", 1);
            uBuffer0.addUniform("height", 1);
            cs1.setUniformBuffer("params", uBuffer0);
            if (numChannels === 4) {
                ComputeHelper._copyTexture4CS = cs1;
                ComputeHelper._copyTexture4Params = uBuffer0;
            }
            else {
                ComputeHelper._copyTexture2CS = cs1;
                ComputeHelper._copyTexture2Params = uBuffer0;
            }
        }
        const cs = numChannels === 4 ? ComputeHelper._copyTexture4CS : ComputeHelper._copyTexture2CS;
        const params = numChannels === 4 ? ComputeHelper._copyTexture4Params : ComputeHelper._copyTexture2Params;
        cs.setTexture("src", source, false);
        cs.setStorageTexture("dest", dest);
        const { width, height } = source.getSize();
        params.updateInt("width", width);
        params.updateInt("height", height);
        params.update();
        ComputeHelper.Dispatch(cs, width, height, 1);
    }
    static CopyBufferToTexture(source, dest) {
        if (!ComputeHelper._copyBufferTextureCS) {
            const engine = dest.getScene().getEngine();
            const cs1 = new BABYLON.ComputeShader("copyBufferTextureCompute", engine, { computeSource: ComputeHelper._copyBufferTextureComputeShader }, {
                bindingsMapping: {
                    "dest": { group: 0, binding: 0 },
                    "src": { group: 0, binding: 1 },
                    "params": { group: 0, binding: 2 },
                }
            });
            const uBuffer0 = new BABYLON.UniformBuffer(engine);
            uBuffer0.addUniform("width", 1);
            uBuffer0.addUniform("height", 1);
            cs1.setUniformBuffer("params", uBuffer0);
            ComputeHelper._copyBufferTextureCS = cs1;
            ComputeHelper._copyBufferTextureParams = uBuffer0;
        }
        ComputeHelper._copyBufferTextureCS.setStorageBuffer("src", source);
        ComputeHelper._copyBufferTextureCS.setStorageTexture("dest", dest);
        const { width, height } = dest.getSize();
        ComputeHelper._copyBufferTextureParams.updateInt("width", width);
        ComputeHelper._copyBufferTextureParams.updateInt("height", height);
        ComputeHelper._copyBufferTextureParams.update();
        ComputeHelper.Dispatch(ComputeHelper._copyBufferTextureCS, width, height, 1);
    }
    static CopyTextureToBuffer(source, dest) {
        if (!ComputeHelper._copyTextureBufferCS) {
            const engine = source.getScene().getEngine();
            const cs1 = new BABYLON.ComputeShader("copyTextureBufferCompute", engine, { computeSource: ComputeHelper._copyTextureBufferComputeShader }, {
                bindingsMapping: {
                    "src": { group: 0, binding: 0 },
                    "dest": { group: 0, binding: 1 },
                    "params": { group: 0, binding: 2 },
                }
            });
            const uBuffer0 = new BABYLON.UniformBuffer(engine);
            uBuffer0.addUniform("width", 1);
            uBuffer0.addUniform("height", 1);
            cs1.setUniformBuffer("params", uBuffer0);
            ComputeHelper._copyTextureBufferCS = cs1;
            ComputeHelper._copyTextureBufferParams = uBuffer0;
        }
        ComputeHelper._copyTextureBufferCS.setTexture("src", source, false);
        ComputeHelper._copyTextureBufferCS.setStorageBuffer("dest", dest);
        const { width, height } = source.getSize();
        ComputeHelper._copyTextureBufferParams.updateInt("width", width);
        ComputeHelper._copyTextureBufferParams.updateInt("height", height);
        ComputeHelper._copyTextureBufferParams.update();
        ComputeHelper.Dispatch(ComputeHelper._copyTextureBufferCS, width, height, 1);
    }
    static ClearTexture(source, color) {
        if (!ComputeHelper._clearTextureCS) {
            const engine = source.getScene().getEngine();
            const cs1 = new BABYLON.ComputeShader("clearTextureCompute", engine, { computeSource: ComputeHelper._clearTextureComputeShader }, {
                bindingsMapping: {
                    "tbuf": { group: 0, binding: 0 },
                    "params": { group: 0, binding: 1 },
                }
            });
            const uBuffer0 = new BABYLON.UniformBuffer(engine);
            uBuffer0.addUniform("color", 4);
            uBuffer0.addUniform("width", 1);
            uBuffer0.addUniform("height", 1);
            cs1.setUniformBuffer("params", uBuffer0);
            ComputeHelper._clearTextureCS = cs1;
            ComputeHelper._clearTextureParams = uBuffer0;
        }
        ComputeHelper._clearTextureCS.setStorageTexture("tbuf", source);
        const { width, height } = source.getSize();
        ComputeHelper._clearTextureParams.updateDirectColor4("color", color);
        ComputeHelper._clearTextureParams.updateInt("width", width);
        ComputeHelper._clearTextureParams.updateInt("height", height);
        ComputeHelper._clearTextureParams.update();
        ComputeHelper.Dispatch(ComputeHelper._clearTextureCS, width, height, 1);
    }
    static Dispatch(cs, numIterationsX, numIterationsY = 1, numIterationsZ = 1) {
        if (!cs.threadGroupSizes) {
            cs.threadGroupSizes = ComputeHelper.GetThreadGroupSizes(cs.shaderPath.computeSource, cs.options.entryPoint ?? "main");
        }
        const threadGroupSizes = cs.threadGroupSizes;
        const numGroupsX = Math.ceil(numIterationsX / threadGroupSizes.x);
        const numGroupsY = Math.ceil(numIterationsY / threadGroupSizes.y);
        const numGroupsZ = Math.ceil(numIterationsZ / threadGroupSizes.z);
        cs.dispatch(numGroupsX, numGroupsY, numGroupsZ);
    }
    static DispatchWhenReady(cs, numIterationsX, numIterationsY = 1, numIterationsZ = 1) {
        if (!cs.threadGroupSizes) {
            cs.threadGroupSizes = ComputeHelper.GetThreadGroupSizes(cs.shaderPath.computeSource, cs.options.entryPoint ?? "main");
        }
        const threadGroupSizes = cs.threadGroupSizes;
        const numGroupsX = Math.ceil(numIterationsX / threadGroupSizes.x);
        const numGroupsY = Math.ceil(numIterationsY / threadGroupSizes.y);
        const numGroupsZ = Math.ceil(numIterationsZ / threadGroupSizes.z);
        return cs.dispatchWhenReady(numGroupsX, numGroupsY, numGroupsZ);
    }
    static CheckForComputeShadersReadiness(computeShaders) {
        return new Promise((resolve) => {
            const checkReady = () => {
                let ready = true;
                computeShaders.forEach((cs) => {
                    ready &&= cs.isReady();
                });
                if (ready) {
                    resolve();
                }
                else {
                    window.setTimeout(checkReady, 16);
                }
            };
            checkReady();
        });
    }
}
