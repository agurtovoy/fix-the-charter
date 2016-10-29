var express = require( 'express' );
var nodemailer = require( 'nodemailer' );
var sendGridTransport = require( 'nodemailer-sendgrid-transport' );
var humanname = require( 'humanname' );
var config = require( 'config' );
var jsonfile = require( 'jsonfile' );
var url = require( 'url' );
var mem = require( 'mem' );
var path = require( 'path' );
var util = require( 'util' );
var _ = require( 'underscore' );


var readFileSync = ( ( path ) => { return jsonfile.readFileSync( path ); } );

function readPageMetadata( settings, pageName ) {
  return readFileSync( path.join( settings.views, pageName + '.json' ) );
}

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
    result[card].image = manifest[ result[card].image ];
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
  res.render( pageName, _.extend( {
    pageName: pageName,
    manifest: _.object( [ 'css', 'js' ].map( ( x ) => [ x, manifest[ 'main.' + x ] ] ) ),
    metadata: pageMetadata( settings, manifest, pageName, requestUrl( req ) )
    }, options || {} ) );
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


var router = express.Router();
var indexPage = '/iowa-city-public-measure-c'; // gives us a CEO boost
router.get( '/', ( req, res, next ) => { return res.redirect( 301, indexPage + '/' ); } );
router.get( indexPage, page.bind( null, 'index' ) );
router.get( '/sample-ballot', page.bind( null, 'sample-ballot' ) );
router.get( '/opinions', page.bind( null, 'opinions' ) );
router.get( '/where-to-vote', page.bind( null, 'where-to-vote' ) );
router.all( '/yard-sign', yardSign.bind( null, 'yard-sign' ) );

module.exports = router;
