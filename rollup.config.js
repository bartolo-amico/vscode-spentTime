/* *
 * Copyright (c) 2022-present, NEXI Digital.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const resolve = require('@rollup/plugin-node-resolve')
const babel = require('@rollup/plugin-babel')
const commonjs = require('@rollup/plugin-commonjs')
const peerDepsExternal = require('rollup-plugin-peer-deps-external')

module.exports = {
	input: `./extension.js`,
	watch: {
		include: `**`,
		clearScreen: false,
	},
	output: [
		{
			file: `./dist/index.js`,
			format: 'umd',
			name: 'SpentTime',
		},
		{
			file: `./dist/index.min.js`,
			format: 'iife',
			name: 'SpentTime',
		},
	],
	plugins: [
		resolve({
			jsnext: true,
			main: true,
			browser: true,
		}),
		commonjs({ include: /node_modules/ }),
		babel({
			babelHelpers: 'bundled',
			exclude: 'node_modules/**', // only transpile our source code
			presets: ['@babel/preset-env'],
		}),
		peerDepsExternal(),
	],
}
