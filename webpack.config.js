var ExtractTextPlugin = require( 'extract-text-webpack-plugin' );
var ManifestPlugin = require('webpack-manifest-plugin');
var outputPath = './public/';

module.exports = {
    entry: './client/main.js',
    output: {
      path: outputPath,
      publicPath: '',
      filename: '[name].[chunkhash].js'
    },
    module: {
      loaders: [
        {
          test: /\.less$/,
          loader: ExtractTextPlugin.extract( 'style-loader', 'css-loader!less-loader!autoprefixer-loader' )
        },
        {
          test: /.*\.(gif|png|jpe?g|svg)$/,
          loaders: [
            'file?name=/images/[name].[sha512:hash:base62:8].[ext]',
            'image-webpack'
          ]
        }
      ]
    },
    plugins: [
       new ExtractTextPlugin( '[name].[contenthash].css' ),
       new ManifestPlugin()
    ],
    imageWebpackLoader: {
      pngquant: {
        quality: '80-90',
        nofs: true,
        speed: 4
      },
      svgo: {
        plugins: [
          {
            removeViewBox: false
          },
          {
            removeEmptyAttrs: false
          }
        ]
      }
    }
};
