const fs = require("fs");
const path = require("path");

const runtimeDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "@prisma",
  "client",
  "runtime",
);

const wasmFiles = [
  "query_engine_bg.postgresql.wasm",
  "query_compiler_bg.postgresql.wasm",
];

for (const file of wasmFiles) {
  const wasmPath = path.join(runtimeDir, file);
  if (!fs.existsSync(wasmPath)) {
    continue;
  }

  const base64 = fs.readFileSync(wasmPath).toString("base64");
  const outputPath = path.join(
    runtimeDir,
    file.replace(".wasm", ".wasm-base64.js"),
  );

  fs.writeFileSync(outputPath, `module.exports = { wasm: "${base64}" };\n`);
}
