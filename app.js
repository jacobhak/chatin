/*
  Main js file
*/
var map;

function initialize () {
  google.maps.event.addDomListener(window, "load", setupMap);
  console.log("jodu");
}

function setupMap () {
  var pos;
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      pos = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
      if (map) map.setCenter(pos);
    });
  }
  pos = new google.maps.LatLng(59.347283,18.073668);

  var mapOptions = {
    center: pos,
    zoom: 18,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
}