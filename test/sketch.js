
function preload() {
  loadColorSpaces();
}

let frameRates = new Array(10).fill(0.0);

function setup() {
  createCanvas(800, 600);
  noLoop();
  noStroke();
}

function draw() {
  background(255);

  enterColorSpace(CIELAB, D65_2);

  colorMode(RGB)
  fill(0, 128, 255);
  rect(100, 100, 400, 400);

  colorMode(CIELAB)
  fill(60.0, 60.0, 30.0, 0.5);
  rect(200, 200, 100, 200);

  exitColorSpace()
  
  colorMode(RGB)
  fill(247.26, 90.92, 95.48, 127);
  rect(300, 200, 100, 200);
  fill(247.26, 90.92, 95.48)
  rect(500, 200, 200, 200);

  fill(0)
  const currentFrameRate = frameRate();
  frameRates.push(currentFrameRate);
  frameRates.shift();
  text(currentFrameRate, 50.0, 50.0)
  text("max: " + Math.max(...frameRates), 50.0, 65.0)
  text("min: " + Math.min(...frameRates), 50.0, 80.0)
  //console.log(frameRate());
}
