var express = require( 'express' );
var config = require( 'config' );
var path = require( 'path' );
var logger = require( 'morgan' );

var app = express();

app.set( 'views', path.join( __dirname, 'views' ) );

app.engine( '.hbs', require('express-handlebars')( {
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: app.get('views') + '/layouts',
  partialsDir: app.get('views') + '/partials',
  helpers: {
    clientKeys: function( key, options ) {
      var fullKey = 'clientKeys.' + key;
      if ( typeof options.fn === 'undefined' )
        return config.get( fullKey );

      return config.has( fullKey )
        ? options.fn( this )
        : options.inverse( this );
    },
    equal: function( x, y, options ) { return x == y ? options.fn( this ) : options.inverse( this ); }
  }
} ) );
app.set( 'view engine', '.hbs' );

app.use( logger( 'dev' ) );

var bodyParser = require( 'body-parser' );
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( { extended: false } ) );
app.use( require( 'express-validator' )() );
app.use( require( 'cookie-parser' )() );

var publicDir = path.join( __dirname, '..', 'public' );
app.set( 'staticDir', publicDir );
app.use( express.static( publicDir ) );
//app.use( require('serve-favicon')( path.join( publicDir, 'favicon.ico') ) );

var router = require( './routes/index' );
app.use( '/', router );

module.exports = app;
