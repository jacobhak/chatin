/*
  Main js file
*/
var map;

function initialize () {
  google.maps.event.addDomListener(window, "load", setupMap);
  console.log("jodu");
}

function setupMap () {
  var mapOptions = {
    center: new google.maps.LatLng(59.347283, 18.073668),
    zoom: 18,
    disableDefaultUI: true,
    mapTypeId: google.maps.MapTypeId.HYBRID
  };
  map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
}