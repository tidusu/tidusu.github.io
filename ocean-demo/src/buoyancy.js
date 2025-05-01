class Buoyancy {
    _size;
    _displacementMap;
    _lengthScale;
    _meshes;
    _numSteps;
    _attenuation;
    enabled = true;
    constructor(size, numSteps = 5, attenuation = 1) {
        this._size = size;
        this._displacementMap = null;
        this._lengthScale = 0;
        this._numSteps = numSteps;
        this._attenuation = attenuation;
        this._meshes = [];
    }
    setWaterHeightMap(map, lengthScale) {
        this._displacementMap = map;
        this._lengthScale = lengthScale;
    }
    addMesh(mesh, frame, yOffset = 0, spaceCoordinates = 0) {
        this._meshes.push({ mesh, frame, yOffset, spaceCoordinates, initQuaternion: mesh.rotationQuaternion.clone(), curStep: 0, curQuaternion: new BABYLON.Quaternion(), stepQuaternion: new BABYLON.Quaternion() });
    }
    set size(size) {
        this._size = size;
    }
    get attenuation() {
        return this._attenuation;
    }
    set attenuation(val) {
        this._attenuation = val;
    }
    get numSteps() {
        return this._numSteps;
    }
    set numSteps(val) {
        this._numSteps = val;
    }
    update() {
        if (!this.enabled) {
            return;
        }
        for (let i = 0; i < this._meshes.length; ++i) {
            this._updateMesh(this._meshes[i]);
        }
    }
    getWaterHeight(position) {
        const tmp = BABYLON.TmpVectors.Vector3[0];
        this._getWaterDisplacement(position, tmp);
        position.subtractToRef(tmp, tmp);
        this._getWaterDisplacement(position, tmp);
        position.subtractToRef(tmp, tmp);
        this._getWaterDisplacement(position, tmp);
        position.subtractToRef(tmp, tmp);
        this._getWaterDisplacement(position, tmp);
        return tmp.y;
    }
    _updateMesh(meshBuoyancy) {
        const tmp = BABYLON.TmpVectors.Vector3[5];
        const tmp2 = BABYLON.TmpVectors.Vector3[6];
        const tmp3 = BABYLON.TmpVectors.Vector3[7];
        const forward = BABYLON.TmpVectors.Vector3[8];
        const right = BABYLON.TmpVectors.Vector3[9];
        const normal = BABYLON.TmpVectors.Vector3[10];
        const forwardU = BABYLON.TmpVectors.Vector3[11];
        const rightU = BABYLON.TmpVectors.Vector3[12];
        const { mesh, frame, yOffset, spaceCoordinates, initQuaternion, curQuaternion, stepQuaternion, curStep } = meshBuoyancy;
        BABYLON.Vector3.TransformCoordinatesToRef(frame.v1, mesh.getWorldMatrix(), tmp);
        const y = this.getWaterHeight(tmp);
        mesh.position.y = y + yOffset;
        if (frame.v2 && frame.v3) {
            if (curStep < this._numSteps) {
                meshBuoyancy.curStep++;
                curQuaternion.multiplyToRef(stepQuaternion, curQuaternion);
                initQuaternion.multiplyToRef(curQuaternion, mesh.rotationQuaternion);
                return;
            }
            BABYLON.Vector3.TransformCoordinatesToRef(frame.v2, mesh.getWorldMatrix(), tmp2);
            tmp2.subtractToRef(tmp, forwardU);
            forwardU.normalize();
            BABYLON.Vector3.TransformCoordinatesToRef(frame.v3, mesh.getWorldMatrix(), tmp3);
            tmp3.subtractToRef(tmp, rightU);
            rightU.normalize();
            tmp.y = y;
            forward.copyFrom(tmp2);
            forward.y = this.getWaterHeight(tmp2);
            forward.subtractToRef(tmp, forward);
            forward.normalize();
            right.copyFrom(tmp3);
            right.y = this.getWaterHeight(tmp3);
            right.subtractToRef(tmp, right);
            right.normalize();
            BABYLON.Vector3.CrossToRef(right, forward, normal);
            BABYLON.Vector3.CrossToRef(forward, normal, right);
            right.normalize();
            let xa = Math.acos(BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(forwardU, forward), 0, 1)) * this._attenuation;
            let za = Math.acos(BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(rightU, right), 0, 1)) * this._attenuation;
            switch (spaceCoordinates) {
                case 0:
                    if (forward.y > forwardU.y)
                        xa = -xa;
                    if (right.y > rightU.y)
                        za = -za;
                    BABYLON.Quaternion.FromEulerAnglesToRef(xa / this._numSteps, za / this._numSteps, 0, meshBuoyancy.stepQuaternion);
                    break;
                case 1:
                    if (forward.y > forwardU.y)
                        xa = -xa;
                    if (right.y < rightU.y)
                        za = -za;
                    BABYLON.Quaternion.FromEulerAnglesToRef(xa / this._numSteps, 0, za / this._numSteps, meshBuoyancy.stepQuaternion);
                    break;
                case 2:
                    if (forward.y > forwardU.y)
                        xa = -xa;
                    if (right.y > rightU.y)
                        za = -za;
                    BABYLON.Quaternion.FromEulerAnglesToRef(xa / this._numSteps, 0, za / this._numSteps, meshBuoyancy.stepQuaternion);
                    break;
            }
            meshBuoyancy.curStep = 0;
        }
    }
    _getWaterDisplacement(position, result) {
        if (!this._displacementMap) {
            result.set(position.x, position.y, position.z);
            return;
        }
        // Sample the displacement map bilinearly
        const mask = this._size - 1;
        const x = (position.x / this._lengthScale) * this._size;
        const z = (position.z / this._lengthScale) * this._size;
        const v0 = BABYLON.TmpVectors.Vector3[1];
        const v1 = BABYLON.TmpVectors.Vector3[2];
        const vA = BABYLON.TmpVectors.Vector3[3];
        const vB = BABYLON.TmpVectors.Vector3[4];
        let v0x = Math.floor(x);
        let v0z = Math.floor(z);
        const xRatio = x - v0x;
        const zRatio = z - v0z;
        v0x = v0x & mask;
        v0z = v0z & mask;
        this._getDisplacement(v0x, v0z, v0);
        this._getDisplacement((v0x + 1) & mask, v0z, v1);
        v1.subtractToRef(v0, vA).scaleToRef(xRatio, vA).addToRef(v0, vA);
        this._getDisplacement(v0x, (v0z + 1) & mask, v0);
        this._getDisplacement((v0x + 1) & mask, (v0z + 1) & mask, v1);
        v1.subtractToRef(v0, vB).scaleToRef(xRatio, vB).addToRef(v0, vB);
        vB.subtractToRef(vA, result).scaleToRef(zRatio, result).addToRef(vA, result);
    }
    _getDisplacement(x, z, result) {
        if (this._displacementMap) {
            result.x = BABYLON.TextureTools.FromHalfFloat(this._displacementMap[z * this._size * 4 + x * 4 + 0]);
            result.y = BABYLON.TextureTools.FromHalfFloat(this._displacementMap[z * this._size * 4 + x * 4 + 1]);
            result.z = BABYLON.TextureTools.FromHalfFloat(this._displacementMap[z * this._size * 4 + x * 4 + 2]);
        }
    }
}
