let myp5;

const sketch = p => {
  myp5 = p;

  p.preload = function () {
    p.loadColorSpaces();
  }

  p.setup = function () {
    p.noLoop();
    mocha.run();
  }
}

new p5(sketch, "p5canvas");