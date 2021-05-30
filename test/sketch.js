
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

  enterColorSpace(CIEXYZ);

  // fill(Color.fromRGB(0, 128, 255))
  fill(25.77 * 2.0, 22.66 * 2.0, 97.62 * 2.0);
  rect(100, 100, 400, 400);
  fill(44.27 * 2.0, 28.12 * 2.0, 14.04 * 2.0, 127.0);
  rect(200, 200, 100, 200);
  // fill(Color.fromRGB(128, 0, 128, 128))
  // rect(100, 100, 400, 400);

  exitColorSpace()

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
