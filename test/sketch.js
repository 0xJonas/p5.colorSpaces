
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

  // fill(25.77 * 2.69, 22.66 * 2.55, 97.62 * 2.35); // rgb(0, 128, 255)
  // rect(100, 100, 400, 400);
  // fill(44.27 * 2.69, 28.12 * 2.55, 14.04 * 2.35, 127.0);  // lab(60, 60, 30)
  // rect(200, 200, 100, 200);

  fill(54.715 * 2.55, 18.777 + 128, -70.918 + 128); // rgb(0, 128, 255)
  rect(100, 100, 400, 400);
  fill(60.0 * 2.55, 60.0 + 128, 30.0 + 128, 127.0);  // lab(60, 60, 30)
  rect(200, 200, 100, 200);

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
