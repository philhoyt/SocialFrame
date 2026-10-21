const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

module.exports = {
	...defaultConfig,
	entry: {
		'editor/index': './src/editor/index.js',
		'admin/index': './src/admin/index.js',
		'new-design/index': './src/new-design/index.js',
		'post-editor/index': './src/post-editor/index.js',
	},
};
