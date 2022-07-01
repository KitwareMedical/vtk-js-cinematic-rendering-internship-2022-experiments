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

const fileURL = "https://data.kitware.com/api/v1/item/62b3ae9bbddec9d0c4578a6f/download";
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
  logLine("Ultrasound test 5: blended, 10% shade");  
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

  piecewiseFunction.addPoint(0.0, 0.0);
  piecewiseFunction.addPoint(15.7754, 0.0);
  piecewiseFunction.addPoint(29.662, 0.510938);
  piecewiseFunction.addPoint(33.2502, 0.111328);
  piecewiseFunction.addPoint(55.4967, 0.205078);
  piecewiseFunction.addPoint(82.049, 0.0);
  piecewiseFunction.addPoint(101.425, 0.505859);
  piecewiseFunction.addPoint(150.941, 0.55859);  
  piecewiseFunction.addPoint(254.993, 0.0);  

  lookupTable.addRGBPoint(0.0, 0.0, 0.0, 0.0);
  lookupTable.addRGBPoint(13.4479, 0.901961, 0.0, 0.0);
  lookupTable.addRGBPoint(39.8265, 0.901961, 0.564706, 0.0);
  lookupTable.addRGBPoint(188.066, 1.0, 1.0, 0.745098);
  lookupTable.addRGBPoint(254.993, 1.0, 1.0, 1.0);

  // Pipeline handling
  actor.setMapper(mapper);
  mapper.setInputData(source);
  mapper.setAutoAdjustSampleDistances(false);

  let bounds = actor.getBounds();
  let center = [(bounds[1]+bounds[0])/2.0,(bounds[3]+bounds[2])/2.0,(bounds[5]+bounds[4])/2.0];

  renderer.removeAllLights();
  const light1 = vtkLight.newInstance();
  const light_pos = [center[0],center[1],center[2]-100];
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
  mapper.setComputeNormalFromOpacity(true);

  mapper.setGlobalIlluminationReach(0.1);
  mapper.setVolumetricScatteringBlending(0.5);
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
  renderer.getActiveCamera().setPosition(center[0],center[1],center[2]-450);
  renderer.getActiveCamera().setViewUp(1,0,0);  
  renderer.resetCameraClippingRange();
  let startTime = Date.now();
  renderWindow.render();     
  logLine("First Render Time: " + (Date.now()-startTime));  

  function renderInteractive(){
    renderer.resetCamera();
    renderer.getActiveCamera().setFocalPoint(center[0],center[1],center[2]);
    renderer.getActiveCamera().setPosition(center[0],center[1],center[2]-450);
    renderer.getActiveCamera().setViewUp(1,0,0);  
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
        logLine("Interactive Render Time: " + (Date.now()-startTime) / numSteps + "ms");       
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
