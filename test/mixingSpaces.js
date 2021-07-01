describe("Mixing color spaces", function () {
  describe("warpToColorSpace()", function () {
    it("sets the mixing color space correctly.", function () {
      myp5.warpToColorSpace(myp5.CIELAB, myp5.D65_2);
      assert.equal(myp5._cs_mixingColorSpace, myp5.CIELAB);
      assert.equal(myp5._cs_mixingWhitePoint, myp5.D65_2);
      myp5.exitColorSpace();
    });

    it("exitColorSpace() works correctly", function () {
      myp5.colorMode(myp5.RGB, 255);
      myp5.warpToColorSpace(myp5.CIELAB, myp5.D65_2);
      myp5.background(188, 155, 3);
      myp5.exitColorSpace();
      const probe = myp5.get(myp5.random(0, myp5.width), myp5.random(0, myp5.height));
      arraysEqualWithin(probe, [188, 155, 3], 1.01);
    });
  });

  describe("enterColorSpace()", function () {
    it("converts the canvas to the target color space", function () {
      myp5.colorMode(myp5.RGB, 255);
      myp5.background(189, 155, 5);
      myp5.enterColorSpace(myp5.CIEXYZ);
      const probe = myp5.get(myp5.random(0, myp5.width), myp5.random(0, myp5.height));
      arraysEqualWithin(probe.map(a => a / 255), [0.32737 / 0.95047, 0.34275, 0.05035 / 1.08883], 1 / 255);
      myp5.exitColorSpace();
    });

    it("exitColorSpace() works correctly", function () {
      myp5.colorMode(myp5.RGB, 255);
      myp5.background(189, 155, 8);
      myp5.enterColorSpace(myp5.CIEXYZ);
      myp5.fill(0.0, 168.0, 98.0);
      myp5.rect(400, 0, 400, 600);
      myp5.exitColorSpace();
      const probe1 = myp5.get(myp5.random(0, myp5.width / 2), myp5.random(0, myp5.height));
      const probe2 = myp5.get(myp5.random(myp5.width / 2, myp5.width), myp5.random(0, myp5.height));
      arraysEqualWithin(probe1, [189, 155, 8], 1);
      arraysEqualWithin(probe2, [0.0, 168.0,  98.0], 1);
    });
  });
});