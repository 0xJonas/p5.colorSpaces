const assert = chai.assert;
const ERROR_MARGIN = 0.5e-3;

function arraysEqualWithin(a1, a2, margin) {
  for (let i = 0; i < Math.min(a1.length, a2.length); i++) {
    if (Math.abs(a1[i] - a2[i]) > margin) {
      assert.fail(`Arrays are not equal within margin: [${a1}] != [${a2}]`);
    }
  }
}

describe("Color overrides", function () {
  describe("color()", function () {
    it("returns an srgb color in sRGB space.", function () {
      myp5.warpToColorSpace(myp5.SRGB);
      const c = myp5.color(0, 162, 205);
      arraysEqualWithin(c._array, [0.0, 162 / 255, 205 / 255], ERROR_MARGIN);
    });

    it("returns a linear rgb color in linear RGB space.", function () {
      myp5.warpToColorSpace(myp5.LINEAR_RGB);
      const c = myp5.color(0, 162, 205);
      arraysEqualWithin(c._array, [0.0, 0.3613067797835095, 0.6104955708078648], ERROR_MARGIN);
    });

    it("returns a CIEXYZ color in CIEXYZ space.", function () {
      myp5.warpToColorSpace(myp5.CIEXYZ);
      const c = myp5.color(0, 162, 205);
      arraysEqualWithin(c._array, [0.23935 / 0.95047, 0.30245, 0.62322 / 1.08883], ERROR_MARGIN);
    });

    it("returns a CIELab color in CIELab space.", function () {
      myp5.warpToColorSpace(myp5.CIELAB, myp5.D65_2);
      const c = myp5.color(0, 162, 205);
      arraysEqualWithin(c._array, [61.865 / 100.0, (-19.882 + 128.0) / 255, (-31.807 + 128.0) / 255], ERROR_MARGIN);
    });

    describe("creates a tristimulus color from a grayscale parameter.", function () {
      it("p5.RGB.", function () {
        myp5.warpToColorSpace(myp5.SRGB);
        myp5.colorMode(myp5.RGB);
        const c = myp5.color(130);
        arraysEqualWithin(c._array, [130 / 255, 130 / 255, 130 / 255], ERROR_MARGIN);
      });

      it("SRGB", function () {
        myp5.warpToColorSpace(myp5.SRGB);
        myp5.colorMode(myp5.SRGB);
        const c = myp5.color(130 / 255);
        arraysEqualWithin(c._array, [130 / 255, 130 / 255, 130 / 255], ERROR_MARGIN);
      });

      it("Linear RGB", function () {
        myp5.warpToColorSpace(myp5.SRGB);
        myp5.colorMode(myp5.LINEAR_RGB);
        const c = myp5.color(0.2232279573168085);
        arraysEqualWithin(c._array, [130 / 255, 130 / 255, 130 / 255], ERROR_MARGIN);
      });

      it("CIEXYZ", function () {
        myp5.warpToColorSpace(myp5.SRGB);
        myp5.colorMode([myp5.CIEXYZ, myp5.D65_2]);
        const c = myp5.color(0.22323);
        arraysEqualWithin(c._array, [130 / 255, 130 / 255, 130 / 255], ERROR_MARGIN);
      });

      it("CIELab", function () {
        myp5.warpToColorSpace(myp5.SRGB);
        myp5.colorMode([myp5.CIELAB, myp5.D65_2]);
        const c = myp5.color(54.368);
        arraysEqualWithin(c._array, [130 / 255, 130 / 255, 130 / 255], ERROR_MARGIN);
      });
    });

    describe("accepts all inputs from the original p5.color() function.", function () {
      it("Short hex strings (#rgb)", function () {
        myp5.warpToColorSpace(myp5.SRGB);
        myp5.colorMode(myp5.RGB);
        const c = myp5.color("#a5c");
        arraysEqualWithin(c._array, [170 / 255, 85 / 255, 204 / 255], ERROR_MARGIN);
      });

      it("Long hex strings (#rrggbb)", function () {
        myp5.warpToColorSpace(myp5.SRGB);
        myp5.colorMode(myp5.RGB);
        const c = myp5.color("#aa55cc");
        arraysEqualWithin(c._array, [170 / 255, 85 / 255, 204 / 255], ERROR_MARGIN);
      });

      it("Named colors", function () {
        myp5.warpToColorSpace(myp5.SRGB);
        myp5.colorMode(myp5.RGB);
        const c = myp5.color("lightskyblue");
        arraysEqualWithin(c._array, [135 / 255, 206 / 255, 250 / 255], ERROR_MARGIN);
      });
      
      it("p5.Color objects", function () {
        myp5.warpToColorSpace(myp5.SRGB);
        myp5.colorMode(myp5.RGB);
        const c1 = myp5.color("lightskyblue");
        const c2 = myp5.color(c1);
        arraysEqualWithin(c1._array, c2._array, ERROR_MARGIN);
      });
    });
  });

  describe("colorMode()", function () {
    it("can set the colorMode to p5.RGB.", function () {
      myp5.warpToColorSpace(myp5.CIEXYZ);
      myp5.colorMode(myp5.RGB);
      const c = myp5.color(108, 0, 175);
      arraysEqualWithin(c._array, [0.1392 / 0.95047, 0.06283, 0.41029 / 1.08883], ERROR_MARGIN);
    });

    it("can set the colorMode to p5.HSB.", function () {
      myp5.warpToColorSpace(myp5.CIEXYZ);
      myp5.colorMode(myp5.HSB);
      const c = myp5.color(277.03, 99.999, 68.627);
      arraysEqualWithin(c._array, [0.1392 / 0.95047, 0.06283, 0.41029 / 1.08883], ERROR_MARGIN);
    });

    it("can set the colorMode to p5.HSL.", function () {
      myp5.warpToColorSpace(myp5.CIEXYZ);
      myp5.colorMode(myp5.HSL);
      const c = myp5.color(277.03, 99.999, 34.314);
      arraysEqualWithin(c._array, [0.1392 / 0.95047, 0.06283, 0.41029 / 1.08883], ERROR_MARGIN);
    });

    it("can set the colorMode to sRGB.", function () {
      myp5.warpToColorSpace(myp5.CIEXYZ);
      myp5.colorMode(myp5.SRGB);
      const c = myp5.color(0.42353, 0.0, 0.68627);
      arraysEqualWithin(c._array, [0.1392 / 0.95047, 0.06283, 0.41029 / 1.08883], ERROR_MARGIN);
    });

    it("can set the colorMode to linear RGB.", function () {
      myp5.warpToColorSpace(myp5.CIEXYZ);
      myp5.colorMode(myp5.LINEAR_RGB);
      const c = myp5.color(0.14996, 0.0, 0.428684);
      arraysEqualWithin(c._array, [0.1392 / 0.95047, 0.06283, 0.41029 / 1.08883], ERROR_MARGIN);
    });

    it("can set the colorMode to CIEXYZ.", function () {
      myp5.warpToColorSpace(myp5.CIEXYZ);
      myp5.colorMode(myp5.CIEXYZ);
      const c = myp5.color(0.1392, 0.06283, 0.41029);
      arraysEqualWithin(c._array, [0.1392 / 0.95047, 0.06283, 0.41029 / 1.08883], ERROR_MARGIN);
    });

    it("can set the colorMode to CIELab.", function () {
      myp5.warpToColorSpace(myp5.CIEXYZ);
      myp5.colorMode(myp5.CIELAB);
      const c = myp5.color(30.116, 64.78, -64.946);
      arraysEqualWithin(c._array, [0.1392 / 0.95047, 0.06283, 0.41029 / 1.08883], ERROR_MARGIN);
    });

    describe("correctly handles max parameters.", function () {
      it("Maxes are used correctly for p5.RGB", function () {
        myp5.warpToColorSpace(myp5.CIEXYZ);
        myp5.colorMode(myp5.RGB, 100, 100, 100);
        const c = myp5.color(42.35294, 0.0, 68.62745);
        arraysEqualWithin(c._array, [0.1392 / 0.95047, 0.06283, 0.41029 / 1.08883], ERROR_MARGIN);
      });

      it("Maxes only affect their specific color space", function () {
        myp5.warpToColorSpace(myp5.CIEXYZ);
        myp5.colorMode(myp5.RGB, 100, 100, 100);
        myp5.colorMode(myp5.SRGB);
        const c = myp5.color(108 / 255, 0, 175 / 255);
        arraysEqualWithin(c._array, [0.1392 / 0.95047, 0.06283, 0.41029 / 1.08883], ERROR_MARGIN);
      })
    });
  });
});
