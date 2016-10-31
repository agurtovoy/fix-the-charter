var express = require( 'express' );
var nodemailer = require( 'nodemailer' );
var sendGridTransport = require( 'nodemailer-sendgrid-transport' );
var humanname = require( 'humanname' );
var moment = require( 'moment' );
var config = require( 'config' );
var jsonfile = require( 'jsonfile' );
var url = require( 'url' );
var mem = require( 'mem' );
var path = require( 'path' );
var util = require( 'util' );
var _ = require( 'underscore' );


var readFileSync = ( ( path ) => { return jsonfile.readFileSync( path ); } );

function readPageMetadata( settings, pageName ) {
  return readFileSync( path.join( settings.views, 'pages', pageName, 'metadata.json' ) );
}


var readPageContent = mem( ( settings, pageName ) => {
  try {
    return readFileSync( path.join( settings.views, 'pages', pageName, 'content.json' ) );
  } catch ( x ) {
    return {};
  }
} );


var webpackManifest = mem( ( settings ) => {
  return readFileSync( path.join( settings.staticDir, 'manifest.json' ) );
} );


var pageMetadata = mem( ( settings, manifest, pageName, pageUrl ) => {
  var defaults = readPageMetadata( settings, 'index' );
  var result = pageName == 'index'
    ? defaults
    : _.defaults( readPageMetadata( settings, pageName ), defaults );

  var pageDefaults = _.pick( result, 'title', 'description' );
  [ 'og', 'twitter' ].forEach( ( card ) => {
    _.defaults( result[card], defaults[card] );
    _.defaults( result[card], pageDefaults );
    result[card].image = url.resolve( pageUrl, manifest[ result[card].image ] );
    if ( 'url' in result[card] )
      result[card].url = pageUrl;
  } );

  return result;
} );


function requestUrl( req ) {
  return url.format( {
    protocol: req.protocol,
    hostname: req.hostname,
    pathname: req.path
  } );
}


function page( pageName, req, res, options ) {
  var settings = req.app.settings;
  var manifest = webpackManifest( settings );
  var pageUrl = requestUrl( req );
  res.render( path.join( 'pages', pageName, 'page' ), _.extend( {
    pageName: pageName,
    pageUrl: pageUrl,
    manifest: _.object( [ 'css', 'js' ].map( ( x ) => [ x, manifest[ 'main.' + x ] ] ) ),
    metadata: pageMetadata( settings, manifest, pageName, pageUrl )
  }, _.defaults( {}, options || {}, readPageContent( settings, pageName ) ) ) );
}


function formatDate( date ) {
  var x = moment( date );
  return moment().dayOfYear() - x.dayOfYear() > 5 ? x.format( 'MMM D' ) : x.fromNow();
}

var opinionsContent = mem( ( settings, pageName, query ) => {
  var result = _.clone( readPageContent( settings, pageName ) );
  result.opinions = _.sortBy(
    result.opinions,
    query.sort == 'rank'
      ? ( x ) => { return -x.rank; }
      : ( x ) => { return -moment( x.date ).valueOf(); }
    ).map( ( x ) => {
      return _.extend( _.clone( x ), { date: formatDate( x.date ) } );
    } );

  return result;
} );

function opinions( pageName, req, res ) {
  var settings = req.app.settings;
  page.call( this, pageName, req, res, opinionsContent( settings, pageName, req.query ) );
}


function sendEmail( fields ) {
    var transport = nodemailer.createTransport( sendGridTransport( {
        auth: {
          api_key: config.get( 'SendGrid.apiToken' )
          }
    } ) );

    var templateSender = transport.templateSender( {
      subject: '[Yard Sign Request] {{name}} at {{address}} wants {{numberOfSigns}} sign(s)',
      html: 'Name: {{name}}<br>Email: {{email}}<br>Phone: {{phone}}<br>Address: <a href="https://maps.google.com/maps?q={{googleMapsAddress}}&z=15">{{address}}</a><br>Number of signs: {{numberOfSigns}}<br>Delivery notes: {{notes}}'
    }, {
        from: 'yardsigns@fix-the-charter.org',
    } );

    templateSender(
      { to: 'yardsigns@fix-the-charter.org' },
      fields,
      function( error, response ) {
        if ( error )
            console.log( error );
        else
            console.log( "Message sent: " + response.message );
      }
    );
}


function handleYardSignRequest( req, renderOptions ) {
  var formFields = [ 'name', 'address', 'numberOfSigns', 'email', 'phone', 'notes' ];

  req.checkBody( 'name', 'name' ).notEmpty();
  req.checkBody( 'address', 'address' ).notEmpty();
  req.checkBody( 'numberOfSigns', 'number of signs' ).notEmpty();

  var errors = [];
  if ( !req.body.email && !req.body.phone )
      errors.push( 'either a phone or email — we need some way of contacting you back!' );

  errors = ( _.pluck( req.validationErrors(), 'msg' ) || [] ).concat( errors );
  if ( errors.length ) {
      console.log( errors );
      _.extend( renderOptions, {
          fields: _.pick( req.body, formFields ),
          error: ( errors.length > 1
                  ? 'Please specify your ' + _.initial( errors ).join( ', ') + ' and ' + _.last( errors )
                  : 'Please specify ' + errors.join( ', ') )
      } );
      return;
  }

  var formData = req.body;
  var parsedName = humanname.parse( formData.name );

  _.extend( renderOptions, {
      requestSubmitted: true,
      firstName: parsedName.firstName,
      thankYou: ( formData.numberOfSigns == 1
          ? 'Your yard sign is on its way!'
          : 'Your yard signs are on their way!' )
  } );

  var emailFields = _.extend( _.pick( formData, formFields ), {
    googleMapsAddress: encodeURIComponent( util.format( '%s, Iowa City, IA', formData.address ) )
  } );

  sendEmail( emailFields );
}


function yardSign( pageName, req, res ) {
    var renderOptions = { fields: { numberOfSigns: 1 } };
    if ( req.method == 'POST' )
      handleYardSignRequest( req, renderOptions );

    page.call( this, pageName, req, res, renderOptions );
}


var indexPage = '/iowa-city-public-measure-c'; // gives us a CEO boost

function redirect( target, req, res ) {
  return res.redirect( 301, target );
}

function pageRoute( router, path, page, pageName, verb ) {
  verb = verb || 'get';
  router[verb]( path, redirect.bind( null, indexPage + path ) );
  router[verb]( indexPage + path, page.bind( null, pageName ) );
  router.sitemapRoute[path] = { hide: true };
}

var router = express.Router();
router.sitemapRoute = {};
pageRoute( router, '/', page, 'index' );
pageRoute( router, '/sample-ballot', page, 'sample-ballot' );
pageRoute( router, '/opinions', opinions, 'opinions' );
pageRoute( router, '/where-to-vote', page, 'where-to-vote' );
pageRoute( router, '/yard-sign', yardSign, 'yard-sign', 'all' );

var sitemap = require( 'express-sitemap' )( {
  generate: router,
  route: router.sitemapRoute,
  url: 'fix-the-charter.org',
  cache: 600000,
} );

router.get('/sitemap.xml', function( req, res ) {
  sitemap.XMLtoWeb( res );
} );


// 404
router.use( function( req, res, next ) {
  res.status( 404 );
  page( '404', req, res, { hideSocial: true } );
} );

router.use( function( err, req, res, next ) {
  if ( req.app.get('env') != 'development' ) {
      err = { status: 500, message: 'Internal Error' };
  }
  res.status( err.status || 500 );
  page( 'error', req, res, {
    message: err.message,
    error: err,
    hideSocial: true
  } );
} );

module.exports = router;
