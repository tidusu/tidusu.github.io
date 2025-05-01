
var Seams;
(function (Seams) {
    Seams[Seams["None"] = 0] = "None";
    Seams[Seams["Left"] = 1] = "Left";
    Seams[Seams["Right"] = 2] = "Right";
    Seams[Seams["Top"] = 4] = "Top";
    Seams[Seams["Bottom"] = 8] = "Bottom";
    Seams[Seams["All"] = 15] = "All";
})(Seams || (Seams = {}));
class OceanGeometry {
    lengthScale = 15; // float
    vertexDensity = 10; // 1-40 int
    clipLevels = 8; // 0-8 int
    skirtSize = 10; // 0-100 float
    noMaterialLod = true;
    useSkirt = true;
    _scene;
    _camera;
    _root;
    _oceanMaterial;
    _materials;
    _trimRotations;
    _center;
    _skirt;
    _rings;
    _trims;
    constructor(oceanMaterial, camera, scene) {
        this._oceanMaterial = oceanMaterial;
        this._camera = camera;
        this._scene = scene;
        this._materials = [];
        this._root = new BABYLON.TransformNode("Ocean", scene);
        this._center = null;
        this._skirt = null;
        this._rings = [];
        this._trims = [];
        this._trimRotations = [
            BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.UpReadOnly, BABYLON.Angle.FromDegrees(180).radians()),
            BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.UpReadOnly, BABYLON.Angle.FromDegrees(90).radians()),
            BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.UpReadOnly, BABYLON.Angle.FromDegrees(270).radians()),
            BABYLON.Quaternion.Identity(),
        ];
    }
    get wireframe() {
        return this._center.material.wireframe;
    }
    set wireframe(w) {
        this._center.material.wireframe = w;
        if (this._skirt) {
            this._skirt.material.wireframe = w;
        }
        this._rings.forEach((m) => m.material.wireframe = w);
        this._trims.forEach((m) => m.material.wireframe = w);
    }
    async initializeMaterials() {
        this._materials[0]?.dispose();
        this._materials[1]?.dispose();
        this._materials[2]?.dispose();
        this._materials = [
            await this._oceanMaterial.getMaterial(true, true),
            await this._oceanMaterial.getMaterial(true, false),
            await this._oceanMaterial.getMaterial(false, false),
        ];
        this._materials.forEach(m => m.backFaceCulling = false);
    }
    initializeMeshes() {
        this._center?.dispose();
        this._skirt?.dispose();
        this._rings?.forEach((m) => m.dispose());
        this._trims?.forEach((m) => m.dispose());
        this._skirt = null;
        this._rings = [];
        this._trims = [];
        this._instantiateMeshes();
    }
    update() {
        this._updatePositions();
        this._updateMaterials();
    }
    getMaterial(index) {
        return this._materials[index];
    }
    _updateMaterials() {
        const activeLevels = this._activeLodLevels;
        this._center.material = this._getMaterial(this.noMaterialLod ? 0 : this.clipLevels - activeLevels - 1);
        for (let i = 0; i < this._rings.length; i++) {
            this._rings[i].material = this._getMaterial(this.noMaterialLod ? 0 : this.clipLevels - activeLevels - i);
            this._trims[i].material = this._getMaterial(this.noMaterialLod ? 0 : this.clipLevels - activeLevels - i);
        }
        if (this.useSkirt) {
            this._skirt.material = this.noMaterialLod ? this._materials[0] : this._materials[2];
        }
    }
    _updatePositions() {
        const k = this._gridSize;
        const activeLevels = this._activeLodLevels;
        let previousSnappedPosition = BABYLON.TmpVectors.Vector3[0];
        const centerOffset = BABYLON.TmpVectors.Vector3[1];
        const snappedPosition = BABYLON.TmpVectors.Vector3[2];
        const trimPosition = BABYLON.TmpVectors.Vector3[3];
        let scale = this._clipLevelScale(-1, activeLevels);
        previousSnappedPosition.copyFrom(this._camera.position);
        this._snap(previousSnappedPosition, scale * 2);
        this._offsetFromCenter(-1, activeLevels, centerOffset);
        this._center.position.copyFrom(previousSnappedPosition).addInPlace(centerOffset);
        this._center.scaling.set(scale, 1, scale);
        for (let i = 0; i < this.clipLevels; i++) {
            this._rings[i].setEnabled(i < activeLevels);
            this._trims[i].setEnabled(i < activeLevels);
            if (i >= activeLevels) {
                continue;
            }
            scale = this._clipLevelScale(i, activeLevels);
            snappedPosition.copyFrom(this._camera.position);
            this._snap(snappedPosition, scale * 2);
            this._offsetFromCenter(i, activeLevels, centerOffset);
            trimPosition.copyFrom(snappedPosition).addInPlace(centerOffset).addInPlaceFromFloats(scale * (k - 1) / 2, 0, scale * (k - 1) / 2);
            const shiftX = (previousSnappedPosition.x - snappedPosition.x) <= 0 ? 1 : 0;
            const shiftZ = (previousSnappedPosition.z - snappedPosition.z) <= 0 ? 1 : 0;
            trimPosition.x += shiftX * (k + 1) * scale;
            trimPosition.z += shiftZ * (k + 1) * scale;
            this._trims[i].position.copyFrom(trimPosition);
            this._trims[i].rotationQuaternion.copyFrom(this._trimRotations[shiftX + 2 * shiftZ]);
            this._trims[i].scaling.set(scale, 1, scale);
            this._rings[i].position.copyFrom(snappedPosition).addInPlace(centerOffset);
            this._rings[i].scaling.set(scale, 1, scale);
            previousSnappedPosition.copyFrom(snappedPosition);
        }
        if (this.useSkirt) {
            scale = this.lengthScale * 2 * Math.pow(2, this.clipLevels);
            this._skirt.position.copyFrom(previousSnappedPosition).addInPlaceFromFloats(-scale * (this.skirtSize + 0.5 - 0.5 / k), 0, -scale * (this.skirtSize + 0.5 - 0.5 / k));
            this._skirt.scaling.set(scale, 1, scale);
        }
    }
    get _activeLodLevels() {
        return this.clipLevels - BABYLON.Scalar.Clamp(Math.floor(Math.log2((1.7 * Math.abs(this._camera.position.y) + 1) / this.lengthScale)), 0, this.clipLevels);
    }
    _clipLevelScale(level, activeLevels) {
        return this.lengthScale / this._gridSize * Math.pow(2, this.clipLevels - activeLevels + level + 1);
    }
    _offsetFromCenter(level, activeLevels, result) {
        const k = this._gridSize;
        const v = ((1 << this.clipLevels) + OceanGeometry._GeometricProgressionSum(2, 2, this.clipLevels - activeLevels + level + 1, this.clipLevels - 1)) * this.lengthScale / k * (k - 1) / 2;
        result.copyFromFloats(-v, 0, -v);
    }
    static _GeometricProgressionSum(b0, q, n1, n2) {
        return b0 / (1 - q) * (Math.pow(q, n2) - Math.pow(q, n1));
    }
    _snap(coords, scale) {
        if (coords.x >= 0) {
            coords.x = Math.floor(coords.x / scale) * scale;
        }
        else {
            coords.x = Math.ceil((coords.x - scale + 1) / scale) * scale;
        }
        if (coords.z < 0) {
            coords.z = Math.floor(coords.z / scale) * scale;
        }
        else {
            coords.z = Math.ceil((coords.z - scale + 1) / scale) * scale;
        }
        coords.y = 0;
    }
    _getMaterial(lodLevel) {
        if (lodLevel - 2 <= 0) {
            return this._materials[0];
        }
        if (lodLevel - 2 <= 2) {
            return this._materials[1];
        }
        return this._materials[2];
    }
    get _gridSize() {
        return 4 * this.vertexDensity + 1;
    }
    _instantiateMeshes() {
        const k = this._gridSize;
        this._center = this._instantiateElement("Center", this._createPlaneMesh(2 * k, 2 * k, 1, Seams.All), this._materials[this._materials.length - 1]);
        const ring = this._createRingMesh(k, 1);
        const trim = this._createTrimMesh(k, 1);
        for (let i = 0; i < this.clipLevels; ++i) {
            this._rings.push(this._instantiateElement("Ring " + i, ring, this._materials[this._materials.length - 1], i > 0));
            this._trims.push(this._instantiateElement("Trim " + i, trim, this._materials[this._materials.length - 1], i > 0));
        }
        if (this.useSkirt) {
            this._skirt = this._instantiateElement("Skirt", this._createSkirtMesh(k, this.skirtSize), this._materials[this._materials.length - 1]);
        }
    }
    _instantiateElement(name, mesh, mat, clone = false) {
        if (clone) {
            mesh = mesh.clone("");
        }
        mesh.name = name;
        mesh.material = mat;
        mesh.parent = this._root;
        mesh.receiveShadows = true;
        return mesh;
    }
    _createSkirtMesh(k, outerBorderScale) {
        const quad = this._createPlaneMesh(1, 1, 1);
        const hStrip = this._createPlaneMesh(k, 1, 1);
        const vStrip = this._createPlaneMesh(1, k, 1);
        const cornerQuadScale = new BABYLON.Vector3(outerBorderScale, 1, outerBorderScale);
        const midQuadScaleVert = new BABYLON.Vector3(1 / k, 1, outerBorderScale);
        const midQuadScaleHor = new BABYLON.Vector3(outerBorderScale, 1, 1 / k);
        const m1 = quad.clone();
        m1.scaling.copyFrom(cornerQuadScale);
        const m2 = hStrip.clone();
        m2.scaling.copyFrom(midQuadScaleVert);
        m2.position.x = outerBorderScale;
        const m3 = quad.clone();
        m3.scaling.copyFrom(cornerQuadScale);
        m3.position.x = outerBorderScale + 1;
        const m4 = vStrip.clone();
        m4.scaling.copyFrom(midQuadScaleHor);
        m4.position.z = outerBorderScale;
        const m5 = vStrip.clone();
        m5.scaling.copyFrom(midQuadScaleHor);
        m5.position.x = outerBorderScale + 1;
        m5.position.z = outerBorderScale;
        const m6 = quad.clone();
        m6.scaling.copyFrom(cornerQuadScale);
        m6.position.z = outerBorderScale + 1;
        const m7 = hStrip.clone();
        m7.scaling.copyFrom(midQuadScaleVert);
        m7.position.x = outerBorderScale;
        m7.position.z = outerBorderScale + 1;
        const m8 = quad.clone();
        m8.scaling.copyFrom(cornerQuadScale);
        m8.position.x = outerBorderScale + 1;
        m8.position.z = outerBorderScale + 1;
        quad.dispose(true, false);
        hStrip.dispose(true, false);
        vStrip.dispose(true, false);
        return BABYLON.Mesh.MergeMeshes([m1, m2, m3, m4, m5, m6, m7, m8], true, true);
    }
    _createTrimMesh(k, lengthScale) {
        const m1 = this._createPlaneMesh(k + 1, 1, lengthScale, Seams.None, 1);
        m1.position.set((-k - 1) * lengthScale, 0, -1 * lengthScale);
        const m2 = this._createPlaneMesh(1, k, lengthScale, Seams.None, 1);
        m2.position.set(-1 * lengthScale, 0, (-k - 1) * lengthScale);
        const mesh = BABYLON.Mesh.MergeMeshes([m1, m2], true, true);
        mesh.rotationQuaternion = new BABYLON.Quaternion();
        return mesh;
    }
    _createRingMesh(k, lengthScale) {
        const m1 = this._createPlaneMesh(2 * k, (k - 1) >> 1, lengthScale, Seams.Bottom | Seams.Right | Seams.Left);
        const m2 = this._createPlaneMesh(2 * k, (k - 1) >> 1, lengthScale, Seams.Top | Seams.Right | Seams.Left);
        m2.position.set(0, 0, (k + 1 + ((k - 1) >> 1)) * lengthScale);
        const m3 = this._createPlaneMesh((k - 1) >> 1, k + 1, lengthScale, Seams.Left);
        m3.position.set(0, 0, ((k - 1) >> 1) * lengthScale);
        const m4 = this._createPlaneMesh((k - 1) >> 1, k + 1, lengthScale, Seams.Right);
        m4.position.set((k + 1 + ((k - 1) >> 1)) * lengthScale, 0, ((k - 1) >> 1) * lengthScale);
        return BABYLON.Mesh.MergeMeshes([m1, m2, m3, m4], true, true);
    }
    _createPlaneMesh(width, height, lengthScale, seams = Seams.None, trianglesShift = 0) {
        const vertices = [];
        const triangles = [];
        const normals = [];
        const vdata = new BABYLON.VertexData();
        vdata.positions = vertices;
        vdata.indices = triangles;
        vdata.normals = normals;
        for (let i = 0; i < height + 1; ++i) {
            for (let j = 0; j < width + 1; ++j) {
                let x = j, z = i;
                if (i === 0 && (seams & Seams.Bottom) || i === height && (seams & Seams.Top)) {
                    x = x & ~1;
                }
                if (j === 0 && (seams & Seams.Left) || j === width && (seams & Seams.Right)) {
                    z = z & ~1;
                }
                vertices[0 + j * 3 + i * (width + 1) * 3] = x * lengthScale;
                vertices[1 + j * 3 + i * (width + 1) * 3] = 0 * lengthScale;
                vertices[2 + j * 3 + i * (width + 1) * 3] = z * lengthScale;
                normals[0 + j * 3 + i * (width + 1) * 3] = 0;
                normals[1 + j * 3 + i * (width + 1) * 3] = 1;
                normals[2 + j * 3 + i * (width + 1) * 3] = 0;
            }
        }
        let tris = 0;
        for (let i = 0; i < height; ++i) {
            for (let j = 0; j < width; ++j) {
                const k = j + i * (width + 1);
                if ((i + j + trianglesShift) % 2 === 0) {
                    triangles[tris++] = k;
                    triangles[tris++] = k + width + 2;
                    triangles[tris++] = k + width + 1;
                    triangles[tris++] = k;
                    triangles[tris++] = k + 1;
                    triangles[tris++] = k + width + 2;
                }
                else {
                    triangles[tris++] = k;
                    triangles[tris++] = k + 1;
                    triangles[tris++] = k + width + 1;
                    triangles[tris++] = k + 1;
                    triangles[tris++] = k + width + 2;
                    triangles[tris++] = k + width + 1;
                }
            }
        }
        const mesh = new BABYLON.Mesh("Clipmap plane", this._scene);
        vdata.applyToMesh(mesh, true);
        return mesh;
    }
}
const foamPicture = "https://assets.babylonjs.com/environments/waterFoam_circular_mask.png";
class OceanMaterial {
    _wavesGenerator;
    _depthRenderer;
    _scene;
    _camera;
    _foamTexture;
    _startTime;
    constructor(depthRenderer, scene) {
        this._wavesGenerator = null;
        this._depthRenderer = depthRenderer;
        this._scene = scene;
        this._camera = scene.activeCameras?.[0] ?? scene.activeCamera;
        this._foamTexture = new BABYLON.Texture(foamPicture, this._scene);
        this._startTime = new Date().getTime() / 1000;
    }
    setWavesGenerator(wavesGenerator) {
        this._wavesGenerator = wavesGenerator;
    }
    readMaterialParameter(mat, name) {
        const tmp = new BABYLON.Color3();
        for (const param in mat._newUniformInstances) {
            const [ptype, pname] = param.split("-");
            let val = mat._newUniformInstances[param];
            if (pname === name) {
                if (ptype === "vec3") {
                    // all vec3 types are color in the shader
                    val = val;
                    tmp.copyFromFloats(val.x, val.y, val.z);
                    tmp.toGammaSpaceToRef(tmp);
                    val = tmp.toHexString();
                }
                return val;
            }
        }
        return null;
    }
    updateMaterialParameter(mat, name, value) {
        const tmp = new BABYLON.Vector3();
        for (const param in mat._newUniformInstances) {
            const [ptype, pname] = param.split("-");
            if (pname === name) {
                if (ptype === "vec3") {
                    // all vec3 types are color in the shader
                    value = BABYLON.Color3.FromHexString(value);
                    value = value.toLinearSpaceToRef(value);
                    tmp.copyFromFloats(value.r, value.g, value.b);
                    value = tmp;
                }
                mat._newUniformInstances[param] = value;
                return;
            }
        }
    }
    async getMaterial(useMid, useClose, useNodeMaterial = false) {
        let mat;
        if (!useNodeMaterial) {
            mat = new BABYLON.PBRCustomMaterial("oceanMat" + (useMid ? "1" : "0") + (useClose ? "1" : "0"), this._scene);
            mat.metallic = 0;
            mat.roughness = 0.311;
            mat.forceIrradianceInFragment = true;
            //mat.realTimeFiltering = true;
            //mat.realTimeFilteringQuality = BABYLON.Constants.TEXTURE_FILTERING_QUALITY_HIGH;
            //mat.wireframe = true;
            const color = new BABYLON.Vector3(0.011126082368383245, 0.05637409755197975, 0.09868919754109445);
            mat.AddUniform("_Color", "vec3", color);
            mat.AddUniform("_MaxGloss", "float", 0.91);
            mat.AddUniform("_RoughnessScale", "float", 0.0044);
            mat.AddUniform("_LOD_scale", "float", 7.13);
            mat.AddUniform("_FoamColor", "vec3", new BABYLON.Vector3(1, 1, 1));
            mat.AddUniform("_FoamScale", "float", 2.4);
            mat.AddUniform("_ContactFoam", "float", 1);
            mat.AddUniform("_FoamBiasLOD0", "float", 0.84);
            mat.AddUniform("_FoamBiasLOD1", "float", 1.83);
            mat.AddUniform("_FoamBiasLOD2", "float", 2.72);
            mat.AddUniform("_SSSColor", "vec3", new BABYLON.Vector3(0.1541919, 0.8857628, 0.990566));
            mat.AddUniform("_SSSStrength", "float", 0.15);
            mat.AddUniform("_SSSBase", "float", -0.261);
            mat.AddUniform("_SSSScale", "float", 4.7);
            mat.AddUniform("lightDirection", "vec3", "");
            mat.AddUniform("_WorldSpaceCameraPos", "vec3", "");
            mat.AddUniform("LengthScale0", "float", this._wavesGenerator.lengthScale[0]);
            mat.AddUniform("LengthScale1", "float", this._wavesGenerator.lengthScale[1]);
            mat.AddUniform("LengthScale2", "float", this._wavesGenerator.lengthScale[2]);
            mat.AddUniform("_Displacement_c0", "sampler2D", this._wavesGenerator.getCascade(0).displacement);
            mat.AddUniform("_Derivatives_c0", "sampler2D", this._wavesGenerator.getCascade(0).derivatives);
            mat.AddUniform("_Turbulence_c0", "sampler2D", this._wavesGenerator.getCascade(0).turbulence);
            mat.AddUniform("_Displacement_c1", "sampler2D", this._wavesGenerator.getCascade(1).displacement);
            mat.AddUniform("_Derivatives_c1", "sampler2D", this._wavesGenerator.getCascade(1).derivatives);
            mat.AddUniform("_Turbulence_c1", "sampler2D", this._wavesGenerator.getCascade(1).turbulence);
            mat.AddUniform("_Displacement_c2", "sampler2D", this._wavesGenerator.getCascade(2).displacement);
            mat.AddUniform("_Derivatives_c2", "sampler2D", this._wavesGenerator.getCascade(2).derivatives);
            mat.AddUniform("_Turbulence_c2", "sampler2D", this._wavesGenerator.getCascade(2).turbulence);
            mat.AddUniform("_Time", "float", 0);
            mat.AddUniform("_CameraDepthTexture", "sampler2D", this._depthRenderer.getDepthMap());
            mat.AddUniform("_CameraData", "vec4", new BABYLON.Vector4(this._camera.minZ, this._camera.maxZ, this._camera.maxZ - this._camera.minZ, 0));
            mat.AddUniform("_FoamTexture", "sampler2D", this._foamTexture);
            const cascades = [];
            if (useMid) {
                cascades.push("#define MID");
            }
            if (useClose) {
                cascades.push("#define CLOSE");
            }
            mat.Vertex_Definitions(`
        ${cascades.join("\n")}

        varying vec2 vWorldUV;
        varying vec2 vUVCoords_c0;
        varying vec2 vUVCoords_c1;
        varying vec2 vUVCoords_c2;
        varying vec3 vViewVector;
        varying vec4 vLodScales;
        varying vec4 vClipCoords;
        varying float vMetric;
    `);
            mat.Fragment_Definitions(`
        ${cascades.join("\n")}

        varying vec2 vWorldUV;
        varying vec2 vUVCoords_c0;
        varying vec2 vUVCoords_c1;
        varying vec2 vUVCoords_c2;
        varying vec3 vViewVector;
        varying vec4 vLodScales;
        varying vec4 vClipCoords;
        varying float vMetric;
        vec3 FOG_COLOR = vec3(0.0, 0.39, 0.62); 
vec3 apply_fog(vec3 original_color, float distance) {
// Calculate fog intensity based on distance.
float fog_intensity = clamp(distance / 200.0, 0.0, 1.0);
// Mix the original color with the fog color based on the computed intensity.
return mix(original_color, FOG_COLOR, fog_intensity);
}



        
// returns [0, 1).
// v is assumed to be an integer
float ibuki(vec4 v)
{
const uvec4 mult = 
uvec4(0xae3cc725, 0x9fe72885, 0xae36bfb5, 0x82c1fcad);

uvec4 u = uvec4(v);
u *= mult;
u ^= u.wxyz ^ u >> 13; 
u *= mult;

uint r = u.x + u.y + u.z + u.w;
r ^= r >> 11;
r = (r * r) ^ r;

return float(r) * 2.3283064365386962890625e-10;
}

vec3 blend_overlay(vec3 base, vec3 blend) {
// Compute a mask: for each channel, mask = 1.0 if base < 0.5, else 0.0.
vec3 mask = vec3(1.0) - step(0.5, base.rgb);
// For each channel, if base < 0.5 then use 2.0 * base * blend,
// otherwise use 1.0 - 2.0 * (1.0 - base) * (1.0 - blend).
vec3 result_rgb = mask * (2.0 * base.rgb * blend.rgb)
            + (1.0 - mask) * (1.0 - 2.0 * (1.0 - base.rgb) * (1.0 - blend.rgb));
// Return the blended color, preserving the alpha channel from blend.
return result_rgb;
}

    `);
            mat.Vertex_After_WorldPosComputed(`
        vWorldUV = worldPos.xz;
    
        vViewVector = _WorldSpaceCameraPos - worldPos.xyz;
        float viewDist = length(vViewVector);
    
        float lod_c0 = min(_LOD_scale * LengthScale0 / viewDist, 1.0);
        float lod_c1 = min(_LOD_scale * LengthScale1 / viewDist, 1.0);
        float lod_c2 = min(_LOD_scale * LengthScale2 / viewDist, 1.0);
            
        vec3 displacement = vec3(0.);
        float largeWavesBias = 0.;
    
        vUVCoords_c0 = vWorldUV / LengthScale0;
        vUVCoords_c1 = vWorldUV / LengthScale1;
        vUVCoords_c2 = vWorldUV / LengthScale2;
    
        displacement += texture2D(_Displacement_c0, vUVCoords_c0).xyz * lod_c0;
        largeWavesBias = displacement.y;
    
        #if defined(MID) || defined(CLOSE)
            displacement += texture2D(_Displacement_c1, vUVCoords_c1).xyz * lod_c1;
        #endif
        #if defined(CLOSE)
            displacement += texture2D(_Displacement_c2, vUVCoords_c2).xyz * lod_c2;
        #endif

        worldPos.xyz += displacement;

        vLodScales = vec4(lod_c0, lod_c1, lod_c2, max(displacement.y - largeWavesBias * 0.8 - _SSSBase, 0) / _SSSScale);
    `);
            mat.Vertex_MainEnd(`
        vClipCoords = gl_Position;
        vMetric = gl_Position.z;
    `);
            mat.Fragment_Before_Lights(`
        
        vec4 derivatives = texture2D(_Derivatives_c0, vUVCoords_c0);
        #if defined(MID) || defined(CLOSE)
            derivatives += texture2D(_Derivatives_c1, vUVCoords_c1) * vLodScales.y;
        #endif
        #if defined(CLOSE)
            derivatives += texture2D(_Derivatives_c2, vUVCoords_c2) * vLodScales.z;
        #endif

        vec2 slope = vec2(derivatives.x / (1.0 + derivatives.z), derivatives.y / (1.0 + derivatives.w));
        normalW = normalize(vec3(-slope.x, 1.0, -slope.y));

        #if defined(CLOSE)
            float jacobian = texture2D(_Turbulence_c0, vUVCoords_c0).x + texture2D(_Turbulence_c1, vUVCoords_c1).x + texture2D(_Turbulence_c2, vUVCoords_c2).x;
            jacobian = min(1.0, max(0., (-jacobian + _FoamBiasLOD2) * _FoamScale));
        #elif defined(MID)
            float jacobian = texture2D(_Turbulence_c0, vUVCoords_c0).x + texture2D(_Turbulence_c1, vUVCoords_c1).x;
            jacobian = min(1.0, max(0., (-jacobian + _FoamBiasLOD1) * _FoamScale));
        #else
            float jacobian = texture2D(_Turbulence_c0, vUVCoords_c0).x;
            jacobian = min(1.0, max(0., (-jacobian + _FoamBiasLOD0) * _FoamScale));
        #endif

        vec2 screenUV = vClipCoords.xy / vClipCoords.w;
        screenUV = screenUV * 0.5 + 0.5;
        float backgroundDepth = texture2D(_CameraDepthTexture, screenUV).r * _CameraData.y;
        float surfaceDepth = vMetric;
        float depthDifference = max(0.0, (backgroundDepth - surfaceDepth) - 0.5);
        float foam = texture2D(_FoamTexture, vWorldUV * 0.5 + _Time * 2.).r;
        jacobian += _ContactFoam * saturate(max(0.0, foam - depthDifference) * 5.0) * 0.9;

        surfaceAlbedo = mix(vec3(0.0), _FoamColor, jacobian);

        vec3 viewDir = normalize(vViewVector);
        vec3 H = normalize(-normalW + lightDirection);
        float ViewDotH = pow5(saturate(dot(viewDir, -H))) * 30.0 * _SSSStrength;
         vec3 color;
         if (gl_FrontFacing) { // Underwater view of the water surface
            color = _Color;
         } else {
            color = mix(_Color, saturate(_Color + _SSSColor.rgb * ViewDotH * vLodScales.w), vLodScales.z);
         }
        

        float fresnel = dot(normalW, viewDir);
        fresnel = saturate(1.0 - fresnel);
        fresnel = pow5(fresnel);
    `);
            mat.Fragment_Custom_MetallicRoughness(`
        float distanceGloss = mix(1.0 - metallicRoughness.g, _MaxGloss, 1.0 / (1.0 + length(vViewVector) * _RoughnessScale));
        metallicRoughness.g = 1.0 - mix(distanceGloss, 0.0, jacobian);
    `);
            mat.Fragment_Before_FinalColorComposition(`
if (gl_FrontFacing) { // Underwater view (looking up)
// For water-to-air, the incident medium is water (IOR ~1.33) and transmitted is air (IOR ~1.0)
float IOR_WATER = 1.33;
float IOR_AIR = 1.0;
float eta = IOR_WATER / IOR_AIR;  // ≃ 1.33

// Our view vector (vViewVector) goes from the water surface to the camera.
// Reverse it to get the incident direction.
vec3 I = normalize(-vViewVector);

// Compute refraction direction
vec3 refractedDir = refract(I, normalW, eta);
bool isTIR = (length(refractedDir) < 0.001);
vec3 tirColor;
vec3 finalRefractionColor;
if (isTIR) {
    // Total Internal Reflection case:
    // Compute the reflection direction (the incident ray reflects fully)
    vec3 reflectDir = reflect(I, normalW);
    vec3 skyReflection = textureCube(reflectionSampler, reflectDir).rgb;

    // Compute the cosine of the incident angle.
    // For rays grazing the surface, cos(angle) is small, meaning more absorption.
    float incidentCos = saturate(dot(normalW, I));
    // Invert it so that grazing rays (low cosine) yield a higher absorption factor.
    float absorptionFactor = 1.0 - incidentCos;

    // Blend the cubemap’s sky reflection with the water’s base color (_Color)
    // so that, at steep grazing angles, the result is much darker.
    tirColor = apply_fog(mix(vec3(0.), _Color, absorptionFactor), length(vViewVector));

    // Optionally, darken the result further to simulate water’s absorption.
    // tirColor *= 1;
    finalRefractionColor = tirColor;
} else {
    // Refraction works normally: sample the cubemap using the refracted direction.
    finalRefractionColor = textureCube(reflectionSampler, refractedDir).rgb;
}

// Combine the chosen color with the jacobian (which boosts brightness based on turbulence/foam)
vec3 subsurfaceColor = finalRefractionColor + jacobian;
color = clamp(subsurfaceColor, 0.0, 4.0);
// -------------------------------------------------------------
// Compute the underwater (refracted) sun direction using Snell's law.
// -------------------------------------------------------------
vec3 _sunDir = normalize(lightDirection);
vec3 N = vec3(0.0, 1.0, 0.0);
// eta = n_air/n_water ≈ 1/1.33
vec3 waterDir = refract(_sunDir, N, 1.0 / 1.33);

// Proceed only if the refracted ray is valid (avoid division by zero)
if (abs(waterDir.y) > 1e-6) {
    vec3 wPos = vPositionW;
    // Find the intersection of the refracted ray with the flat water surface (y = 0)
    float t = -wPos.y / waterDir.y;
    float iX = wPos.x + t * waterDir.x;
    float iZ = wPos.z + t * waterDir.z;

    // -------------------------------------------------------------
    // Apply Depth-Dependent Scattering
    // -------------------------------------------------------------
    // Compute depth (a positive value underwater)
    float depth = -wPos.y;
    // The scatteringFactor (in m^-1) is chosen from physically plausible water scattering values.
    float scatteringFactor = 0.1;

    // Generate two random numbers using a seeded function (ibuki)
    uvec4 seed1 = uvec4(uint((wPos.x + 100.0) * 1000.0),
                        uint((wPos.y + 100.0) * 1000.0),
                        uint((wPos.z + 100.0) * 1000.0),
                        0u);
    uvec4 seed2 = uvec4(uint((wPos.x + 100.0) * 1000.0),
                        uint((wPos.y + 100.0) * 1000.0),
                        uint((wPos.z + 100.0) * 1000.0),
                        1u);
    float rand1 = ibuki(seed1); // Random in [0,1)
    float rand2 = ibuki(seed2); // Independent random in [0,1)
    // Choose a random angle (full circle)
    float theta = rand1 * 6.283185307;
    // The offset magnitude scales with depth and an extra random factor
    float offsetMagnitude = depth * scatteringFactor * rand2;
    vec2 scatterOffset = vec2(cos(theta), sin(theta)) * offsetMagnitude;

    // Apply the random scattering offset to the computed surface intersection.
    float iX_scattered = iX + scatterOffset.x;
    float iZ_scattered = iZ + scatterOffset.y;

    // -------------------------------------------------------------
    // Sample the Caustic (Turbulence) Textures
    // -------------------------------------------------------------
    // Compute UVs for each cascade using the scattered intersection.
    vec2 uvC0 = vec2(iX_scattered, iZ_scattered) / LengthScale0;
    vec2 uvC1 = vec2(iX_scattered, iZ_scattered) / LengthScale1;
    vec2 uvC2 = vec2(iX_scattered, iZ_scattered) / LengthScale2;

    // Sample each texture.
    vec4 caustic0 = texture(_Turbulence_c0, uvC0);
    vec4 caustic1 = texture(_Turbulence_c1, uvC1);
    vec4 caustic2 = texture(_Turbulence_c2, uvC2);

    // Instead of per-cascade falloff, average them equally.
    vec3 causticCombined = ((caustic0 + caustic1 + caustic2) / 3.0).xyz;

    // -------------------------------------------------------------
    // Blend Caustics and Apply Fog
    // -------------------------------------------------------------
    // Compute a view-space distance (for fog blending).
    float d = length(vViewVector);
    // Blend the caustic effect with the original fragment color.
    vec3 overlayed = blend_overlay(color, causticCombined);
    // Finally, apply fog.
    color = apply_fog(overlayed, d);

    // -------------------------------------------------------------
    // Volumetric Light Ray Accumulation with Wavelength-Dependent Attenuation
    // -------------------------------------------------------------
    {
        // Tunable parameters.
        float stepLength = 0.5;   // Distance (in world units) between successive samples.
        int maxSteps = 10;        // Maximum number of steps along the view ray.

        // Get the extinction coefficients per wavelength (for example, (0.25, 0.10, 0.05)).
        vec3 extinction = vec3(0.25, 0.10, 0.05);

        // Get world-space camera and fragment positions.
        vec3 camPos = _WorldSpaceCameraPos;
        vec3 fragPos = vPositionW;

        // Compute the normalized view ray (from camera to fragment) and the total distance.
        vec3 viewRayDir = normalize(fragPos - camPos);
        float totalDistance = distance(camPos, fragPos);

        // Initialize volumetric contribution.
        vec3 volumetricContribution = vec3(0.0);
        vec3 currentSamplePos = camPos;
        float accumulatedDistance = 0.0;
        int totalStepsCount = 0;

        // Step along the view ray from the camera to the fragment.
        for (int i = 0; i < maxSteps; i++) {
            if (accumulatedDistance >= totalDistance)
                break;

            currentSamplePos += viewRayDir * stepLength;
            accumulatedDistance += stepLength;

            // Process only if the sample point is underwater.
            if (currentSamplePos.y < 0.0) {
                // For this sample point, compute the refracted (Snell-bent) sun ray.
                vec3 sunDir_sample = normalize(lightDirection);
                vec3 N_sample = vec3(0.0, 1.0, 0.0);  // Flat water surface normal.
                vec3 waterDir_sample = refract(sunDir_sample, N_sample, 1.0 / 1.33);

                if (abs(waterDir_sample.y) > 1e-6) {
                    // Compute the distance along the refracted ray from the sample to the water surface (y = 0).
                    float t_sample = -currentSamplePos.y / waterDir_sample.y;
                    // Compute the UV coordinate: the water surface point reached by the refracted ray.
                    vec2 sampleUV = vec2(currentSamplePos.x + t_sample * waterDir_sample.x,
                                           currentSamplePos.z + t_sample * waterDir_sample.z);

                    // Map the UV coordinate into each turbulence (caustic) cascade.
                    vec2 uvC0_sample = sampleUV / LengthScale0;
                    vec2 uvC1_sample = sampleUV / LengthScale1;
                    vec2 uvC2_sample = sampleUV / LengthScale2;

                    // Sample the turbulence textures.
                    vec3 caustic0_sample = texture(_Turbulence_c0, uvC0_sample).rgb;
                    vec3 caustic1_sample = texture(_Turbulence_c1, uvC1_sample).rgb;
                    vec3 caustic2_sample = texture(_Turbulence_c2, uvC2_sample).rgb;

                    // Optionally, blend the cascades using depth-dependent weights.
                    float depth_sample = -currentSamplePos.y;  // Depth is positive underwater.
                    float depthScale = 0.8;
                    float c2Weight = clamp(1.0 - depth_sample / (20.0 * depthScale), 0.0, 1.0);
                    float c1Weight = clamp(1.0 - depth_sample / (40.0 * depthScale), 0.0, 1.0);
                    float c0Weight = clamp(1.0 - depth_sample / (80.0 * depthScale), 0.0, 1.0);
                    float sumWeights = c0Weight + c1Weight + c2Weight;
                    vec3 sampleCaustic = vec3(0.0);
                    if (sumWeights > 0.0001) {
                        sampleCaustic = (c0Weight * caustic0_sample +
                                         c1Weight * caustic1_sample +
                                         c2Weight * caustic2_sample) / sumWeights;
                    }

                    // Compute wavelength-dependent attenuation for this sample.
                    // For each channel: attenuation = exp(-sigma * accumulatedDistance)
                    vec3 attenuationRGB = exp(-extinction * accumulatedDistance);
                    vec3 attenuation = attenuationRGB;

                    // Accumulate the weighted contribution.
                    volumetricContribution += sampleCaustic * attenuation * stepLength;
                }
            }
            totalStepsCount++;
        }

        // Finally, add the volumetric contribution to the fragment's color.
        // (Dividing by totalStepsCount to average the contribution.)
        color = blend_overlay(color, volumetricContribution / float(totalStepsCount));
    }
}
// Use jacobian to blend in a little extra darkness if needed.
finalEmissive = mix(color, vec3(0.0), jacobian);
 if (isTIR) { finalEmissive = tirColor; }
} else {
// Above water view (or non-upward-facing fragments): use your standard blending.
color = mix(_Color, saturate(_Color + _SSSColor.rgb * ViewDotH * vLodScales.w), vLodScales.z);
finalEmissive = mix(color * (1.0 - fresnel), vec3(0.0), jacobian);
}
`);
            mat.Fragment_Before_FragColor(`
    // undersea
    // if (gl_FrontFacing) { finalColor = vec4(1.0, 0.0, 0.0, 1.0); return; }
        //finalColor = vec4(toGammaSpace((normalW + vec3(1.)) / vec3(2.)), 1.);
        //finalColor = vec4(vec3(surfaceDepth), 1.);
    `);
            mat.onBindObservable.add(() => {
                const time = ((new Date().getTime() / 1000) - this._startTime) / 10;
                mat.getEffect()?.setVector3("_WorldSpaceCameraPos", this._camera.position);
                mat.getEffect()?.setTexture("_Turbulence_c0", this._wavesGenerator.getCascade(0).turbulence);
                mat.getEffect()?.setTexture("_Turbulence_c1", this._wavesGenerator.getCascade(1).turbulence);
                mat.getEffect()?.setTexture("_Turbulence_c2", this._wavesGenerator.getCascade(2).turbulence);
                mat.getEffect()?.setFloat("_Time", time);
                mat.getEffect()?.setVector3("lightDirection", this._scene.lights[0].direction);
            });
            return new Promise((resolve) => {
                if (this._foamTexture.isReady()) {
                    resolve(mat);
                }
                else {
                    this._foamTexture.onLoadObservable.addOnce(() => {
                        resolve(mat);
                    });
                }
            });
        }
        else {
            mat = await BABYLON.NodeMaterial.ParseFromSnippetAsync("R4152I#24", this._scene);
            mat.getInputBlockByPredicate((b) => b.name === "LOD_scale").value = 7.13;
            mat.getInputBlockByPredicate((b) => b.name === "LengthScale0").value = this._wavesGenerator.lengthScale[0];
            mat.getInputBlockByPredicate((b) => b.name === "Roughness").value = 0.311;
            mat.getInputBlockByPredicate((b) => b.name === "metallic").value = 0;
            mat.getBlockByName("Displacement_c0").texture = this._wavesGenerator.getCascade(0).displacement;
            mat.getBlockByName("Derivatives_c0").texture = this._wavesGenerator.getCascade(0).derivatives;
            //(mat.getBlockByName("PBRMetallicRoughness") as BABYLON.PBRMetallicRoughnessBlock).realTimeFiltering = true;
            mat.build();
        }
        return mat;
    }
}
