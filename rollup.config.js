export default [
  {
    input: "./js/main.js",
    output: {
      format: "es",
      file: "./dist/p5.colorspaces.js",
    }
  },
  {
    input: "./js/worker.js",
    output: {
      format: "iife",
      file: "./dist/worker.js"
    }
  }
]