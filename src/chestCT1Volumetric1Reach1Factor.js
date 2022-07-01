import 'vtk.js/Sources/favicon';

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import 'vtk.js/Sources/Rendering/Profiles/Volume';
import 'vtk.js/Sources/Rendering/Profiles/Geometry';
import macro from 'vtk.js/Sources/macros';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkLight from 'vtk.js/Sources/Rendering/Core/Light';
import vtkXMLImageDataReader from 'vtk.js/Sources/IO/XML/XMLImageDataReader';
import HttpDataAccessHelper from 'vtk.js/Sources/IO/Core/DataAccessHelper/HttpDataAccessHelper';
import vtkBoundingBox from 'vtk.js/Sources/Common/DataModel/BoundingBox';
import vtkFPSMonitor from 'vtk.js/Sources/Interaction/UI/FPSMonitor';

// Force the loading of HttpDataAccessHelper to support gzip decompression
import 'vtk.js/Sources/IO/Core/DataAccessHelper/HttpDataAccessHelper';
import controlPanel from './controller.html';
import style from './VolumeViewer.module.css';

// ----------------------------------------------------------------------------
// Helper
// ----------------------------------------------------------------------------
var getGlobal = function () {
  if (typeof self !== 'undefined') { return self; }
  if (typeof window !== 'undefined') { return window; }
  if (typeof global !== 'undefined') { return global; }
  throw new Error('unable to locate global object');
};
var global = getGlobal();

const fileURL = "https://data.kitware.com/api/v1/item/62b38b37bddec9d0c45366e3/download";
const fpsMonitor = vtkFPSMonitor.newInstance();

function logLine(...args) {
  document.querySelector('textarea').value += `${args.join(' ')}\n`;
}
function applyStyle(el, style) {
  Object.keys(style).forEach((key) => {
    el.style[key] = style[key];
  });
}
const STYLE_CONTROL_PANEL = {
  position: 'absolute',
  left: '25px',
  top: '25px',
  backgroundColor: 'white',
  borderRadius: '5px',
  listStyle: 'none',
  padding: '5px 10px',
  margin: '0',
  display: 'block',
  border: 'solid 1px black',
  maxWidth: 'calc(100% - 70px)',
  maxHeight: 'calc(100% - 60px)',
  overflow: 'auto',
};

// ----------------------------------------------------------------------------
// Main rendering block
// ----------------------------------------------------------------------------
function createViewer(rootContainer, fileContents) {
  // ----------------------------------------------------------------------------
  // Controller panel
  // ----------------------------------------------------------------------------
  const controlContainer = document.createElement('div');
  applyStyle(
    controlContainer,
    STYLE_CONTROL_PANEL
  );
  rootContainer.appendChild(controlContainer);
  controlContainer.innerHTML = controlPanel;
  logLine("Chest CT test 3: volume-based, 100% shade");  
  logLine("\n");
  // ----------------------------------------------------------------------------
  // FPS rader
  // ----------------------------------------------------------------------------
  const fpsElm = fpsMonitor.getFpsMonitorContainer();
  fpsElm.style.position = 'absolute';
  fpsElm.style.left = '10px';
  fpsElm.style.bottom = '10px';
  fpsElm.style.background = 'rgba(255,255,255,0.5)';
  fpsElm.style.borderRadius = '5px';
  fpsMonitor.setContainer(rootContainer);
  // ----------------------------------------------------------------------------
  // Create rendering container and renderWindow
  // ----------------------------------------------------------------------------
  const grw = vtkGenericRenderWindow.newInstance();
  const grwContainer = document.createElement('div');
  grw.getOpenGLRenderWindow().setSize(500,500);
  grw.setContainer(grwContainer);
  rootContainer.appendChild(grwContainer);
  // Get GPU and browser info
  const allInfo = grw.getOpenGLRenderWindow().getGLInformations();
  const { UNMASKED_RENDERER, UNMASKED_VENDOR, WEBGL_VERSION } = allInfo;
  const vendor = UNMASKED_VENDOR.value;
  const gpu = UNMASKED_RENDERER.value;
  const webgl = WEBGL_VERSION.value;
  logLine("GPU vender: " + vendor + "; GPU info: " + gpu + "; Webgl version: " + webgl);
  logLine("\n");
  logLine("Browser info: " + navigator.userAgent);
  logLine("\n");
    
  // read data
  const vtiReader = vtkXMLImageDataReader.newInstance();
  vtiReader.parseAsArrayBuffer(fileContents)
  const source = vtiReader.getOutputData(0);  
  const renderer = grw.getRenderer();
  renderer.setTwoSidedLighting(false);
  const renderWindow = grw.getRenderWindow();
  fpsMonitor.setRenderWindow(renderWindow);

  const actor = vtkVolume.newInstance();
  const mapper = vtkVolumeMapper.newInstance();
  const dataArray =
    source.getPointData().getScalars() || source.getPointData().getArrays()[0];
  const dataRange = dataArray.getRange();
  const lookupTable = vtkColorTransferFunction.newInstance();
  const piecewiseFunction = vtkPiecewiseFunction.newInstance();    

  piecewiseFunction.addPoint(-1024.0, 0.0);
  piecewiseFunction.addPoint(67.4682, 0.0);
  piecewiseFunction.addPoint(67.469, 0.65);
  piecewiseFunction.addPoint(85.0, 0.65);
  piecewiseFunction.addPoint(85.0031, 0.0);
  piecewiseFunction.addPoint(200.0031, 0.0);
  piecewiseFunction.addPoint(200.2970, 0.626);
  piecewiseFunction.addPoint(408.2970, 0.626);
  piecewiseFunction.addPoint(3532.0, 0.556);

  lookupTable.addRGBPoint(-1024.0, 0.937254, 0.937254, 0.937254);
  lookupTable.addRGBPoint(4.0927, 0.709019, 0.337254, 0.262745);
  lookupTable.addRGBPoint(98.8057, 0.601372, 0.290196, 0.247058);
  lookupTable.addRGBPoint(100.0, 0.881, 0.836078, 0.773333);
  lookupTable.addRGBPoint(1000.0, 0.881, 0.836078, 0.773333);
  lookupTable.addRGBPoint(3532.0, 0.91, 0.826078, 0.783333);

  // Pipeline handling
  actor.setMapper(mapper);
  mapper.setInputData(source);
  mapper.setAutoAdjustSampleDistances(false);

  let bounds = actor.getBounds();
  let center = [(bounds[1]+bounds[0])/2.0,(bounds[3]+bounds[2])/2.0,(bounds[5]+bounds[4])/2.0];

  renderer.removeAllLights();
  const light1 = vtkLight.newInstance();
  const light_pos = [center[0],center[1]-400,center[2]+10];
  light1.setPositional(true);
  light1.setLightType('SceneLight');
  light1.setPosition(light_pos);
  light1.setFocalPoint(center);
  light1.setColor(1, 1, 1);
  light1.setIntensity(1.0);
  light1.setConeAngle(90.0);
  renderer.addLight(light1);

  const sampleDistance =
  0.7 *
  Math.sqrt(
    source
      .getSpacing()
      .map((v) => v * v)
      .reduce((a, b) => a + b, 0)
  );
  mapper.setSampleDistance(sampleDistance/2.0);
  mapper.setComputeNormalFromOpacity(false);

  mapper.setGlobalIlluminationReach(1.0);
  mapper.setVolumetricScatteringBlending(1.0);
  mapper.setVolumeShadowSamplingDistFactor(1.0);

  actor.getProperty().setRGBTransferFunction(0, lookupTable);
  actor.getProperty().setScalarOpacity(0, piecewiseFunction);
  actor.getProperty().setInterpolationTypeToFastLinear();

  // For better looking volume rendering
  // - distance in world coordinates a scalar opacity of 1.0
  actor
    .getProperty()
    .setScalarOpacityUnitDistance(
      0,
      vtkBoundingBox.getDiagonalLength(source.getBounds()) /
        Math.max(...source.getDimensions())
    );
  actor.getProperty().setGradientOpacityMinimumValue(0, 0);
  actor
    .getProperty()
    .setGradientOpacityMaximumValue(0, (dataRange[1] - dataRange[0]) * 0.05);
  // - Use shading based on gradient
  actor.getProperty().setShade(true);
  actor.getProperty().setUseGradientOpacity(0, false);
  // - generic good default
  actor.getProperty().setGradientOpacityMinimumOpacity(0, 0.0);
  actor.getProperty().setGradientOpacityMaximumOpacity(0, 1.0);
  actor.getProperty().setAmbient(0.0);
  actor.getProperty().setDiffuse(3.0);
  actor.getProperty().setSpecular(0.0);
  actor.getProperty().setSpecularPower(0.0);
  actor.getProperty().setUseLabelOutline(false);
  actor.getProperty().setLabelOutlineThickness(2);
  renderer.addActor(actor);
  
  // first render
  renderer.resetCamera();
  renderer.getActiveCamera().setFocalPoint(center[0],center[1],center[2]);
  renderer.getActiveCamera().setPosition(center[0],center[1]-1000,center[2]+10);
  renderer.resetCameraClippingRange();
  let startTime = Date.now();
  renderWindow.render();     
  logLine("First Render Time: " + (Date.now()-startTime));  

  function renderInteractive(){
    renderer.resetCamera();
    renderer.getActiveCamera().setFocalPoint(center[0],center[1],center[2]);
    renderer.getActiveCamera().setPosition(center[0],center[1]-1000,center[2]+10);
    renderer.resetCameraClippingRange();
    let animationSub = null;
    const numSteps = 50;
    let curStep = 0;
    const performStep = (startTime) => {
      renderer.getActiveCamera().azimuth(-2.0);
      renderer.getActiveCamera().elevation(-2.0);
      renderer.getActiveCamera().orthogonalizeViewUp();
      renderer.getActiveCamera().modified();    
      curStep += 1;
      if (curStep === numSteps) {
        animationSub.unsubscribe();
        renderer.resetCameraClippingRange();

        const cancelRequest = () => {
          renderWindow.getInteractor().cancelAnimation(renderWindow);
        };
        setTimeout(cancelRequest, 0);
        logLine("Interactive Render Time: " + (Date.now()-startTime) / numSteps);       
      }
    };
    
    let startTime = Date.now();
    renderWindow.getInteractor().requestAnimation(renderWindow);
    animationSub = renderWindow.getInteractor().onAnimation(() => performStep(startTime));     
  }

  renderInteractive();
  function reRun() {  
    renderInteractive();
  }
  global.source = vtiReader;
  global.mapper = mapper;
  global.actor = actor;
  global.renderer = renderer;
  global.renderWindow = renderWindow;
  global.reRun = reRun;   
}

const myContainer = document.querySelector('body');

const progressContainer = document.createElement('div');
progressContainer.setAttribute('class', style.progress);
myContainer.appendChild(progressContainer);

const progressCallback = (progressEvent) => {
  if (progressEvent.lengthComputable) {
    const percent = Math.floor(
      (100 * progressEvent.loaded) / progressEvent.total
    );
    progressContainer.innerHTML = `Loading ${percent}%`;
  } else {
    progressContainer.innerHTML = macro.formatBytesToProperUnit(
      progressEvent.loaded
    );
  }
};

HttpDataAccessHelper.fetchBinary(fileURL, {
  progressCallback,
}).then((binary) => {
  myContainer.removeChild(progressContainer);
  createViewer(myContainer, binary);
});
