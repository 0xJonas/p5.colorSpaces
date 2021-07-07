function preload() {
  loadColorSpaces();
}

const NUM_SPHERES = 10;
const MAX_RADIUS = 120.0;
const MIN_RADIUS = 60.0;
const MIN_VELOCITY = 1.0;
const MAX_VELOCITY = 4.0;

let spheres = [];
let alphaSlider;
let colorSpaceSelector;

const WINDOW_LENGTH_FRAME_RATES = 60;
let frameRates = new Array(WINDOW_LENGTH_FRAME_RATES).fill(0.0);

function setup() {
  createCanvas(800, 600);
  // frameRate(30.0)
  alphaSlider = createSlider(0, 1.0, 0.5, 0.0);
  colorSpaceSelector = createSelect();
  colorSpaceSelector.option("sRGB", SRGB);
  colorSpaceSelector.option("CIEXYZ", CIEXYZ);
  colorSpaceSelector.option("CIELab", CIELAB);
  colorSpaceSelector.option("CIELuv", CIELUV);

  const centerX = width / 2;
  const centerY = height / 2;
  const spawnRadius = Math.min(width, height) / 4;
  for (let i = 0; i < NUM_SPHERES; i++) {
    const x = -Math.sin(TAU * i / NUM_SPHERES) * spawnRadius + centerX;
    const y = -Math.cos(TAU * i / NUM_SPHERES) * spawnRadius + centerY;
    const vel = p5.Vector.random2D();
    vel.setMag(random(MIN_VELOCITY, MAX_VELOCITY));
    spheres.push({
      pos: new p5.Vector(x, y),
      vel: vel,
      hue: 360 / NUM_SPHERES * i,
      radius: random(MIN_RADIUS, MAX_RADIUS)
    });
  }
}

function drawFrameRateHistory() {
  colorMode(RGB);
  fill(0, 200, 255);
  for (let i = 0; i < WINDOW_LENGTH_FRAME_RATES; i++) {
    rect(i * 3, 100 - frameRates[i], 3, frameRates[i]);
  }

  fill(0);
  let currentFrameRate = frameRates[WINDOW_LENGTH_FRAME_RATES - 1];
  text("Current frame rate: " + currentFrameRate, 20, 20);
  text("Min frame rate: " + Math.min(...frameRates), 20, 40);
  text("Max frame rate: " + Math.max(...frameRates), 20, 60);
}

function draw() {
  // warpToColorSpace(colorSpaceSelector.value());
  warpToColorSpace(CIEXYZ);

  background("white");
  colorMode(HSL);
  noStroke();

  const alpha = alphaSlider.value();
  for (let sphere of spheres) {
    fill(sphere.hue, 100.0, 50.0, alpha);
    circle(sphere.pos.x, sphere.pos.y, sphere.radius);

    sphere.pos.add(sphere.vel);
    if (sphere.pos.x < sphere.radius || sphere.pos.x >= width - sphere.radius) {
      sphere.vel.x *= -1.0;
    }
    if (sphere.pos.y < sphere.radius || sphere.pos.y >= height - sphere.radius) {
      sphere.vel.y *= -1.0;
    }
  }

  exitColorSpace();

  frameRates.push(frameRate());
  frameRates.shift();
  drawFrameRateHistory();
}
