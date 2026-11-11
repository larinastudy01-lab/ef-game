// Run the existing pure browser modules with CRA's installed Babel; no new dependency.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '../..');
const cache = new Map();

function loadSource(relativePath) {
  const filename = path.resolve(root, relativePath);
  const analyticsRoot = path.join(root, 'src/analytics') + path.sep;
  if (!filename.startsWith(analyticsRoot) && filename !== path.join(root, 'src/lib/behavioralSync.js')) {
    throw new Error('P0 loader only permits the pure analytics and behavioral sync modules');
  }
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  cache.set(filename, loaded);
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (specifier) => specifier.startsWith('.')
    ? loadSource(path.relative(root, require.resolve(path.resolve(path.dirname(filename), specifier))))
    : originalRequire(specifier);
  const compiled = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  loaded._compile(compiled.code, filename);
  return loaded.exports;
}

module.exports = { loadSource };
