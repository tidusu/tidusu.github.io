// Babylon.js 引擎初始化与渲染循环
var canvas = document.getElementById("renderCanvas");

var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        if (window.sceneToRender && window.sceneToRender.activeCamera) {
            window.sceneToRender.render();
        }
    });
}

var engine = null;
var scene = null;
window.sceneToRender = null;

var createDefaultEngine = async function () {
    var engine = new BABYLON.WebGPUEngine(canvas);
    await engine.initAsync();
    return engine;
};