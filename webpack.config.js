var ExtractTextPlugin = require( 'extract-text-webpack-plugin' );
var config = require( 'config' );
var buildVersion = config.get( "build.version" );

module.exports = {
    entry: './client/main.js',
    output: {
      path: './public/' + buildVersion,
      publicPath: '/' + buildVersion,
      filename: '[name].js'
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
       new ExtractTextPlugin( '/[name].css' )
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
