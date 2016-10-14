var express = require('express');
var nodemailer = require('nodemailer');
var sendGridTransport = require('nodemailer-sendgrid-transport');
var humanname = require('humanname');
var config = require('config');
var util = require('util');
var _ = require('underscore');


function page( pageName, req, res, options ) {
  res.render( pageName, _.extend( {
    pageName: pageName,
    title: 'Vote YES on Measure C',
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
router.get( '/', page.bind( null, 'index' ) );
router.get( '/sample-ballot', page.bind( null, 'sample-ballot' ) );
router.get( '/opinions', page.bind( null, 'opinions' ) );
router.get( '/where-to-vote', page.bind( null, 'where-to-vote' ) );
router.all( '/yard-sign', yardSign.bind( null, 'yard-sign' ) );

module.exports = router;
