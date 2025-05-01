// 主场景和 Playground 类
BABYLON.WebGPUTintWASM.ShowWGSLShaderCode = true;
BABYLON.WebGPUTintWASM.DisableUniformityAnalysis = true;

class Playground {
    static CreateScene(engine, canvas) {
        // debugger
        BABYLON.ShaderStore.ShadersStoreWGSL.geometryPixelShader = BABYLON.ShaderStore.ShadersStoreWGSL.geometryPixelShader.replace(
            `normalOutput=normalize( vec3f(mat4x4f(input.vWorldView0,input.vWorldView0,input.vWorldView2,input.vWorldView3)* vec4f(normalW,0.0)));`,
            ``
        );
        //@ts-ignore
        engine.dbgShowShaderCode = true;
        const oceanDemo = new Ocean();
        return oceanDemo.createScene(engine, canvas);
    }
}

// 替换 lightFragment shader
BABYLON.Effect.IncludesShadersStore["lightFragment"] = BABYLON.Effect.IncludesShadersStore["lightFragment"].replace(
    "info.diffuse*=computeProjectionTextureDiffuseLighting(projectionLightSampler{X},textureProjectionMatrix{X});",
    `vec3 projCol = computeProjectionTextureDiffuseLighting(projectionLightSampler{X},textureProjectionMatrix{X});
info.diffuse = vec3(0.);
info.specular = vec3(0.);
baseColor.rgb *= projCol;
`
);