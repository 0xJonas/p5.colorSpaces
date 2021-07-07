import { string } from "rollup-plugin-string";

export default {
  input: "./js/main.js",
  output: {
    format: "es",
    file: "./dist/p5.colorspaces.js",
  },
  plugins: [
    string({
      include: "./**/*.glsl"
    })
  ]
}
