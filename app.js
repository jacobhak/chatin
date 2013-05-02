/*
  Main js file
*/
var map;

function initialize () {
  google.maps.event.addDomListener(window, 'ready', setupMap);
}

function setupMap () {
  var mapOptions = {
    center: new google.maps.LatLng(59.347283, 18.073668),
    zoom: 18,
    disableDefaultUI: true
  };
  map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
}