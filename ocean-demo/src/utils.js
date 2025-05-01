var PixelType;
(function (PixelType) {
    PixelType[PixelType["UINT"] = 0] = "UINT";
    PixelType[PixelType["HALF"] = 1] = "HALF";
    PixelType[PixelType["FLOAT"] = 2] = "FLOAT";
})(PixelType || (PixelType = {}));
var CompressionType;
(function (CompressionType) {
    CompressionType[CompressionType["NO_COMPRESSION"] = 0] = "NO_COMPRESSION";
    CompressionType[CompressionType["RLE_COMPRESSION"] = 1] = "RLE_COMPRESSION";
    CompressionType[CompressionType["ZIPS_COMPRESSION"] = 2] = "ZIPS_COMPRESSION";
    CompressionType[CompressionType["ZIP_COMPRESSION"] = 3] = "ZIP_COMPRESSION";
    CompressionType[CompressionType["PIZ_COMPRESSION"] = 4] = "PIZ_COMPRESSION";
    CompressionType[CompressionType["PXR24_COMPRESSION"] = 5] = "PXR24_COMPRESSION";
    CompressionType[CompressionType["B44_COMPRESSION"] = 6] = "B44_COMPRESSION";
    CompressionType[CompressionType["B44A_COMPRESSION"] = 7] = "B44A_COMPRESSION";
})(CompressionType || (CompressionType = {}));
var LineOrder;
(function (LineOrder) {
    LineOrder[LineOrder["INCREASING_Y"] = 0] = "INCREASING_Y";
    LineOrder[LineOrder["DECREASING_Y"] = 1] = "DECREASING_Y";
    LineOrder[LineOrder["RANDOM_Y"] = 2] = "RANDOM_Y";
})(LineOrder || (LineOrder = {}));
class EXRSerializer {
    _buffer;
    _dataLength;
    _view;
    _growSize;
    get buffer() {
        return this._buffer;
    }
    constructor() {
        this._buffer = new Uint8Array(0);
        this._dataLength = 0;
        this._view = new DataView(this._buffer.buffer);
        this._growSize = 2000;
    }
    serialize(width, height, data, channels = ["R", "G", "B", "A"]) {
        this._dataLength = 0;
        const numChannels = channels.length;
        this._capacity(width * height * numChannels * 4);
        const channelsLayout = [];
        const allChannels = ["A", "B", "G", "R"];
        let channelsMask = 0;
        for (let i = 0; i < allChannels.length; ++i) {
            if (channels.indexOf(allChannels[i]) >= 0) {
                channelsLayout.push({ name: allChannels[i], pixelType: PixelType.FLOAT });
                channelsMask = channelsMask | (1 << (3 - i));
            }
        }
        this._add([0x76, 0x2f, 0x31, 0x01]); // magic
        this._addInt32(0x00000002); // version
        this._addHeaderAttribute_chlist("channels", channelsLayout);
        this._addHeaderAttribute_compression("compression", CompressionType.NO_COMPRESSION);
        this._addHeaderAttribute_box2i("dataWindow", 0, 0, width - 1, height - 1);
        this._addHeaderAttribute_box2i("displayWindow", 0, 0, width - 1, height - 1);
        this._addHeaderAttribute_lineOrder("lineOrder", LineOrder.INCREASING_Y);
        this._addHeaderAttribute_float("pixelAspectRatio", 1);
        this._addHeaderAttribute_v2f("screenWindowCenter", 0, 0);
        this._addHeaderAttribute_float("screenWindowWidth", width);
        this._addNull();
        const offsetTable = [];
        const offsetTableSize = height * 8;
        const pixelDataSize = width * numChannels * 4;
        let scanlineOffset = this._dataLength + offsetTableSize;
        for (let y = 0; y < height; ++y) {
            offsetTable.push(BigInt(scanlineOffset));
            scanlineOffset += pixelDataSize + 8;
        }
        this._addUint64(offsetTable);
        for (let y = 0; y < height; ++y) {
            this._addUint32(y);
            this._addUint32(pixelDataSize);
            for (let channel = 3; channel >= 0; --channel) {
                if (channelsMask & (1 << channel)) {
                    for (let x = 0; x < width; ++x) {
                        const v = data[y * width * numChannels + x * numChannels + channel];
                        this._addFloat(v);
                    }
                }
            }
        }
        this._buffer = this._buffer.slice(0, this._dataLength);
        this._view = new DataView(this._buffer.buffer);
    }
    download(fileName) {
        BABYLON.Tools.Download(new Blob([this._buffer.buffer], { type: "application/octet-stream" }), fileName);
    }
    _addHeaderAttribute_chlist(name, channels) {
        this._addString(name);
        this._addNull();
        this._addString("chlist");
        this._addNull();
        let headerSize = 1;
        for (let i = 0; i < channels.length; ++i) {
            headerSize += channels[i].name.length + 1;
            headerSize += 4 // pixelType
                + 1 // pLinear
                + 3 // filling
                + 4 * 2; // xSampling & ySampling
        }
        this._addUint32(headerSize);
        for (let i = 0; i < channels.length; ++i) {
            const channel = channels[i];
            this._addString(channel.name);
            this._addNull();
            this._addInt32(channel.pixelType);
            this._addUint8(0); // pLinear
            this._addNull(3); // filling
            this._addInt32([1, 1]); // xSampling & ySampling
        }
        this._addNull();
    }
    _addHeaderAttribute_compression(name, compression) {
        this._addString(name);
        this._addNull();
        this._addString("compression");
        this._addNull();
        this._addUint32(1);
        this._addUint8(compression);
    }
    _addHeaderAttribute_box2i(name, xMin, yMin, xMax, yMax) {
        this._addString(name);
        this._addNull();
        this._addString("box2i");
        this._addNull();
        this._addUint32(4 * 4);
        this._addInt32([xMin, yMin, xMax, yMax]);
    }
    _addHeaderAttribute_lineOrder(name, lineOrder) {
        this._addString(name);
        this._addNull();
        this._addString("lineOrder");
        this._addNull();
        this._addUint32(1);
        this._addUint8(lineOrder);
    }
    _addHeaderAttribute_float(name, value) {
        this._addString(name);
        this._addNull();
        this._addString("float");
        this._addNull();
        this._addUint32(4);
        this._addFloat(value);
    }
    _addHeaderAttribute_v2f(name, value1, value2) {
        this._addString(name);
        this._addNull();
        this._addString("v2f");
        this._addNull();
        this._addUint32(4 * 2);
        this._addFloat([value1, value2]);
    }
    _addString(s) {
        this._capacity(s.length);
        for (let i = 0; i < s.length; ++i) {
            this._view.setUint8(this._dataLength++, s.charCodeAt(i));
        }
    }
    _addInt8(v) {
        if (Array.isArray(v)) {
            this._capacity(v.length);
            for (let i = 0; i < v.length; ++i) {
                this._view.setInt8(this._dataLength++, v[i]);
            }
        }
        else {
            this._capacity(1);
            this._view.setInt8(this._dataLength, v);
            this._dataLength += 1;
        }
    }
    _addUint8(v) {
        this._capacity(1);
        this._view.setUint8(this._dataLength, v);
        this._dataLength += 1;
    }
    _addInt16(v) {
        if (Array.isArray(v)) {
            this._capacity(2 * v.length);
            for (let i = 0; i < v.length; ++i) {
                this._view.setInt16(this._dataLength, v[i], true);
                this._dataLength += 2;
            }
        }
        else {
            this._capacity(2);
            this._view.setInt16(this._dataLength, v, true);
            this._dataLength += 2;
        }
    }
    _addUint16(v) {
        if (Array.isArray(v)) {
            this._capacity(2 * v.length);
            for (let i = 0; i < v.length; ++i) {
                this._view.setUint16(this._dataLength, v[i], true);
                this._dataLength += 2;
            }
        }
        else {
            this._view.setUint16(this._dataLength, v, true);
            this._dataLength += 2;
        }
    }
    _addInt32(v) {
        if (Array.isArray(v)) {
            this._capacity(4 * v.length);
            for (let i = 0; i < v.length; ++i) {
                this._view.setInt32(this._dataLength, v[i], true);
                this._dataLength += 4;
            }
        }
        else {
            this._capacity(4);
            this._view.setInt32(this._dataLength, v, true);
            this._dataLength += 4;
        }
    }
    _addUint32(v) {
        if (Array.isArray(v)) {
            this._capacity(4 * v.length);
            for (let i = 0; i < v.length; ++i) {
                this._view.setUint32(this._dataLength, v[i], true);
                this._dataLength += 4;
            }
        }
        else {
            this._capacity(4);
            this._view.setUint32(this._dataLength, v, true);
            this._dataLength += 4;
        }
    }
    _addUint64(v) {
        if (Array.isArray(v)) {
            this._capacity(8 * v.length);
            for (let i = 0; i < v.length; ++i) {
                this._view.setBigUint64(this._dataLength, v[i], true);
                this._dataLength += 8;
            }
        }
        else {
            this._capacity(v.byteLength);
            for (let i = 0; i < v.length; ++i) {
                this._view.setBigUint64(this._dataLength, v[i], true);
                this._dataLength += 8;
            }
        }
    }
    _addFloat(v) {
        if (Array.isArray(v)) {
            this._capacity(4 * v.length);
            for (let i = 0; i < v.length; ++i) {
                this._view.setFloat32(this._dataLength, v[i], true);
                this._dataLength += 4;
            }
        }
        else if (v instanceof Float32Array) {
            this._capacity(v.byteLength);
            this._buffer.set(v, this._dataLength);
            this._dataLength += v.byteLength;
        }
        else {
            this._capacity(4);
            this._view.setFloat32(this._dataLength, v, true);
            this._dataLength += 4;
        }
    }
    _addNull(num = 1) {
        this._capacity(num);
        while (num-- > 0) {
            this._view.setUint8(this._dataLength++, 0);
        }
    }
    _add(data) {
        if (Array.isArray(data)) {
            data = new Uint8Array(data);
        }
        const dataLength = data.byteLength;
        this._capacity(dataLength);
        this._buffer.set(data, this._dataLength);
        this._dataLength += dataLength;
    }
    _capacity(size) {
        if (this._dataLength + size <= this._buffer.byteLength) {
            return;
        }
        this._growBuffer(Math.max(this._growSize, size));
    }
    _growBuffer(addSize) {
        const newBuffer = new Uint8Array(this._buffer.byteLength + addSize);
        newBuffer.set(this._buffer, 0);
        this._buffer = newBuffer;
        this._view = new DataView(this._buffer.buffer);
    }
}
const fp32 = BABYLON.Tools.FloatRound;
class Vector3Float32 extends BABYLON.Vector3 {
    /**
     * Gets the class name
     * @returns the string "Vector3Float32"
     */
    getClassName() {
        return "Vector3Float32";
    }
    /**
     * Adds the given coordinates to the current Vector3Float32
     * @param x defines the x coordinate of the operand
     * @param y defines the y coordinate of the operand
     * @param z defines the z coordinate of the operand
     * @returns the current updated Vector3Float32
     */
    addInPlaceFromFloats(x, y, z) {
        this.x = fp32(this.x + x);
        this.y = fp32(this.y + y);
        this.z = fp32(this.z + z);
        return this;
    }
    /**
     * Gets a new Vector3Float32, result of the addition the current Vector3Float32 and the given vector
     * @param otherVector defines the second operand
     * @returns the resulting Vector3Float32
     */
    add(otherVector) {
        return this.addToRef(otherVector, new Vector3Float32(this._x, this._y, this._z));
    }
    /**
     * Gets a new Vector3Float32, result of the addition the current Vector3Float32 and the given vector
     * @param otherVector defines the second operand
     * @returns the resulting Vector3Float32
     */
    addScalar(scalar) {
        const result = new Vector3Float32(scalar, scalar, scalar);
        return this.addToRef(result, result);
    }
    /**
     * Adds the current Vector3Float32 to the given one and stores the result in the vector "result"
     * @param otherVector defines the second operand
     * @param result defines the Vector3Float32 object where to store the result
     * @returns the "result" vector
     */
    addToRef(otherVector, result) {
        return result.copyFromFloats(fp32(this._x + otherVector._x), fp32(this._y + otherVector._y), fp32(this._z + otherVector._z));
    }
    /**
     * Subtract the given vector from the current Vector3Float32
     * @param otherVector defines the second operand
     * @returns the current updated Vector3Float32
     */
    subtractInPlace(otherVector) {
        this.x = fp32(this.x - otherVector._x);
        this.y = fp32(this.y - otherVector._y);
        this.z = fp32(this.z - otherVector._z);
        return this;
    }
    /**
     * Returns a new Vector3Float32, result of the subtraction of the given vector from the current Vector3Float32
     * @param otherVector defines the second operand
     * @returns the resulting Vector3Float32
     */
    subtract(otherVector) {
        return new Vector3Float32(this._x, this._y, this._z).subtractInPlace(otherVector);
    }
    /**
     * Subtracts the given vector from the current Vector3Float32 and stores the result in the vector "result".
     * @param otherVector defines the second operand
     * @param result defines the Vector3Float32 object where to store the result
     * @returns the "result" vector
     */
    subtractToRef(otherVector, result) {
        return this.subtractFromFloatsToRef(otherVector._x, otherVector._y, otherVector._z, result);
    }
    /**
     * Returns a new Vector3Float32 set with the subtraction of the given floats from the current Vector3Float32 coordinates
     * @param x defines the x coordinate of the operand
     * @param y defines the y coordinate of the operand
     * @param z defines the z coordinate of the operand
     * @returns the resulting Vector3Float32
     */
    subtractFromFloats(x, y, z) {
        return this.subtractFromFloatsToRef(x, y, z, new Vector3Float32(this._x, this._y, this._z));
    }
    /**
     * Subtracts the given floats from the current Vector3Float32 coordinates and set the given vector "result" with this result
     * @param x defines the x coordinate of the operand
     * @param y defines the y coordinate of the operand
     * @param z defines the z coordinate of the operand
     * @param result defines the Vector3Float32 object where to store the result
     * @returns the "result" vector
     */
    subtractFromFloatsToRef(x, y, z, result) {
        return result.copyFromFloats(fp32(this._x - x), fp32(this._y - y), fp32(this._z - z));
    }
    /**
     * Multiplies the Vector3Float32 coordinates by the float "scale"
     * @param scale defines the multiplier factor
     * @returns the current updated Vector3Float32
     */
    scaleInPlace(scale) {
        this.x = fp32(this.x * scale);
        this.y = fp32(this.y * scale);
        this.z = fp32(this.z * scale);
        return this;
    }
    /**
     * Returns a new Vector3Float32 set with the current Vector3Float32 coordinates multiplied by the float "scale"
     * @param scale defines the multiplier factor
     * @returns a new Vector3Float32
     */
    scale(scale) {
        return new Vector3Float32(this._x, this._y, this._z).scaleInPlace(scale);
    }
    /**
     * Multiplies the current Vector3Float32 coordinates by the float "scale" and stores the result in the given vector "result" coordinates
     * @param scale defines the multiplier factor
     * @param result defines the Vector3Float32 object where to store the result
     * @returns the "result" vector
     */
    scaleToRef(scale, result) {
        return result.copyFromFloats(fp32(this._x * scale), fp32(this._y * scale), fp32(this._z * scale));
    }
    /**
     * Scale the current Vector3Float32 values by a factor and add the result to a given Vector3Float32
     * @param scale defines the scale factor
     * @param result defines the Vector3Float32 object where to store the result
     * @returns the "result" vector
     */
    scaleAndAddToRef(scale, result) {
        return result.addInPlaceFromFloats(fp32(this._x * scale), fp32(this._y * scale), fp32(this._z * scale));
    }
    /**
     * Multiplies the current Vector3Float32 coordinates by the given ones
     * @param otherVector defines the second operand
     * @returns the current updated Vector3Float32
     */
    multiplyInPlace(otherVector) {
        this.x = fp32(this.x * otherVector._x);
        this.y = fp32(this.y * otherVector._y);
        this.z = fp32(this.z * otherVector._z);
        return this;
    }
    /**
     * Returns a new Vector3Float32, result of the multiplication of the current Vector3Float32 by the given vector
     * @param otherVector defines the second operand
     * @returns the new Vector3Float32
     */
    multiply(otherVector) {
        return this.multiplyByFloats(otherVector._x, otherVector._y, otherVector._z);
    }
    /**
     * Multiplies the current Vector3Float32 by the given one and stores the result in the given vector "result"
     * @param otherVector defines the second operand
     * @param result defines the Vector3Float32 object where to store the result
     * @returns the "result" vector
     */
    multiplyToRef(otherVector, result) {
        return result.copyFromFloats(fp32(this._x * otherVector._x), fp32(this._y * otherVector._y), fp32(this._z * otherVector._z));
    }
    /**
     * Returns a new Vector3Float32 set with the result of the mulliplication of the current Vector3Float32 coordinates by the given floats
     * @param x defines the x coordinate of the operand
     * @param y defines the y coordinate of the operand
     * @param z defines the z coordinate of the operand
     * @returns the new Vector3Float32
     */
    multiplyByFloats(x, y, z) {
        const result = new Vector3Float32(x, y, z);
        return this.multiplyToRef(result, result);
    }
    /**
     * Returns a new Vector3Float32 set with the result of the division of the current Vector3Float32 coordinates by the given ones
     * @param otherVector defines the second operand
     * @returns the new Vector3Float32
     */
    divide(otherVector) {
        return this.divideToRef(otherVector, new Vector3Float32());
    }
    /**
     * Divides the current Vector3Float32 coordinates by the given ones and stores the result in the given vector "result"
     * @param otherVector defines the second operand
     * @param result defines the Vector3Float32 object where to store the result
     * @returns the "result" vector
     */
    divideToRef(otherVector, result) {
        return result.copyFromFloats(fp32(this._x / otherVector._x), fp32(this._y / otherVector._y), fp32(this._z / otherVector._z));
    }
    /**
     * Divides the current Vector3Float32 coordinates by the given ones.
     * @param otherVector defines the second operand
     * @returns the current updated Vector3Float32
     */
    divideInPlace(otherVector) {
        return this.divideToRef(otherVector, this);
    }
    /**
     * Returns a new Vector3Float32, result of applying pow on the current Vector3Float32 by the given vector
     * @param otherVector defines the second operand
     * @returns the new Vector3Float32
     */
    pow(otherVector) {
        const result = new Vector3Float32();
        result.x = fp32(Math.pow(this._x, otherVector._x));
        result.y = fp32(Math.pow(this._y, otherVector._y));
        result.z = fp32(Math.pow(this._z, otherVector._z));
        return result;
    }
    /**
     * Gets the length of the Vector3Float32
     * @returns the length of the Vector3Float32
     */
    length() {
        return fp32(Math.sqrt(fp32(fp32(fp32(this._x * this._x) + fp32(this._y * this._y)) + fp32(this._z * this._z))));
    }
    /**
     * Gets the squared length of the Vector3Float
     * @returns squared length of the Vector3Float
     */
    lengthSquared() {
        return fp32(fp32(fp32(this._x * this._x) + fp32(this._y * this._y)) + fp32(this._z * this._z));
    }
    /**
     * Normalize the current Vector3Float32.
     * Please note that this is an in place operation.
     * @returns the current updated Vector3Float32
     */
    normalize() {
        return this.normalizeFromLength(this.length());
    }
    /**
     * Normalize the current Vector3Float32 with the given input length.
     * Please note that this is an in place operation.
     * @param len the length of the vector
     * @returns the current updated Vector3Float32
     */
    normalizeFromLength(len) {
        if (len === 0 || len === 1.0) {
            return this;
        }
        return this.scaleInPlace(fp32(1.0 / len));
    }
    /**
     * Normalize the current Vector3Float32 to a new vector
     * @returns the new Vector3Float32
     */
    normalizeToNew() {
        const normalized = new Vector3Float32(0, 0, 0);
        this.normalizeToRef(normalized);
        return normalized;
    }
    /**
     * Normalize the current Vector3Float32 to the reference
     * @param reference define the Vector3Float32 to update
     * @returns the updated Vector3Float32
     */
    normalizeToRef(reference) {
        const len = this.length();
        if (len === 0 || len === 1.0) {
            return reference.copyFromFloats(this._x, this._y, this._z);
        }
        return this.scaleToRef(fp32(1.0 / len), reference);
    }
    /**
     * Copies the given floats to the current Vector3Float32 coordinates
     * @param x defines the x coordinate of the operand
     * @param y defines the y coordinate of the operand
     * @param z defines the z coordinate of the operand
     * @returns the current updated Vector3Float32
     */
    copyFromFloats(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }
    /**
     * Returns a new Vector3Float32 located for "amount" (float) on the linear interpolation between the vectors "start" and "end"
     * @param start defines the start value
     * @param end defines the end value
     * @param amount max defines amount between both (between 0 and 1)
     * @returns the new Vector3Float32
     */
    static Lerp(start, end, amount) {
        var result = new Vector3Float32(0, 0, 0);
        Vector3Float32.LerpToRef(start, end, amount, result);
        return result;
    }
    /**
     * Sets the given vector "result" with the result of the linear interpolation from the vector "start" for "amount" to the vector "end"
     * @param start defines the start value
     * @param end defines the end value
     * @param amount max defines amount between both (between 0 and 1)
     * @param result defines the Vector3Float32 where to store the result
     */
    static LerpToRef(start, end, amount, result) {
        result.x = fp32(start._x + fp32(fp32(end._x - start._x) * amount));
        result.y = fp32(start._y + fp32(fp32(end._y - start._y) * amount));
        result.z = fp32(start._z + fp32(fp32(end._z - start._z) * amount));
        return result;
    }
    /**
     * Returns the dot product (float) between the vectors "left" and "right"
     * @param left defines the left operand
     * @param right defines the right operand
     * @returns the dot product
     */
    static Dot(left, right) {
        return fp32(fp32(fp32(left._x * right._x) + fp32(left._y * right._y)) + fp32(left._z * right._z));
    }
    /**
     * Converts a Vector3 to a Vector3Float32
     * @param source source Vector3
     * @param destination destination Vector3Float32
     */
    static ToFloat32(source, destination) {
        destination.set(fp32(source.x), fp32(source.y), fp32(source.z));
    }
}
