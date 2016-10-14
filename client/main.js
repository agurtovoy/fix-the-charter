require( './main.less' );
var $ = require( 'jquery' );
var Stickyfill = require( 'stickyfill' );
var throttle = require( 'throttle-debounce/throttle' );

$( document ).ready( function() {
  var stickyfill = Stickyfill();
  var headerNav = $('.header-nav');
  stickyfill.add( headerNav[0] );

  function markAsSticky() {
    var navTop = headerNav[0].getBoundingClientRect().top;
    headerNav[ navTop == 0 ? 'addClass' : 'removeClass' ]( 'sticky' );
  }

  $( document ).scroll( throttle( 100, markAsSticky ) );
  markAsSticky();
} );
