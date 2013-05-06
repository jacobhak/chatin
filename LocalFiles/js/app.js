/*
	Main js file
*/
var map;

/** Cloudbase helper object */
var helper;

function handleLogin() {
	var username = $("#email").val();
	var password = $("#password").val();
	console.log("got user: "+username+" pass: "+password);
	loginOrRegister(username, password, function(success){
		if (success) {
			$.mobile.changePage("#map-page");
		} else {
			$("#placeholder").append("Login or register failed");
		}
	});
}

function handleLogout() {
	$.mobile.changePage("#loginOrRegister-page");
}

function handleMe() {
	$.mobile.changePage("#me-page");
}

function handleMap() {
	$.mobile.changePage("#map-page");
}

function handleFriends() {
	$.mobile.changePage("#friends-page");
}

function initialize () {
	$("#map-page").on('pageshow', setupMap);
	$("#loginButton").on("click",handleLogin);
	$("#logoutButton").on("click",handleLogout);
	$(".meButton").on("click", handleMe);
	$(".mapButton").on("click", handleMap);
	$(".friendsButton").on("click", handleFriends);
}

function initCB() {
	if (!helper) {
		var moSyncHelper = new MoSyncHelper();
		helper = new CBHelper("chatin", "bb1cab8b28f7f7551c74591fe4c81332", moSyncHelper);
		helper.setPassword(hex_md5("mopub13project"));
	}
}

/** User authentication */
var user;

/**
 * Attempts to log in as the given user in username with password.
 * If there is no user with that username, a new one is created.
 * callback is a function taking a boolean indicating success (user logged in or was registered)
 */
function loginOrRegister(username, password, callback) {
	console.log("Login or register, username = " + username + ", password = " + password);
	var tmpUser = { "username": username, "password": hex_md5(password) };
	helper.authUsername = username;
	helper.authPassword = hex_md5(password);

	helper.searchDocuments(tmpUser, "users", function(resp) {
		console.log("LOG IN Status: " + resp.httpStatus + ", EMsg: " + resp.errorMessage + ", Output: " + resp.outputString);
		if (resp.callStatus) {
			console.log("Successful search");
			// Successful search
			if (resp.outputData.length > 0) {
				// Correct username and password
				user = tmpUser;
				console.log("Correct log in");
				callback(true);
				return;
			}
		}

		// Failed to log in
		console.log("Failed search/login -- trying to create a new user");

		delete helper.authUsername;
		delete helper.authPassword;
		// Create a new user
		helper.insertDocument("users", tmpUser, null, function(resp) {
			console.log("REGISTER Status: " + resp.httpStatus + ", EMsg: " + resp.errorMessage + ", Output: " + resp.outputString);
			if (resp.callStatus) {
				user = tmpUser;
				helper.authUsername = user.username;
				helper.authPassword = user.password;
				console.log("Registered");
				callback(true);
				return;
			} else {
				console.log("Failed to register a new user");
				callback(false);
				return;
			}
		});
	});
}

/**
 * Checks in the currently logged in user at the position defined by the center of the map, storing the given
 * radius along with the check in.
 * callback is a function taking a boolean indicating success.
 */
function checkIn(radius, callback) {
	var pos = map.getCenter();
	var loc = new CBHelperCurrentLocation(pos.lat(), pos.lng(), 1);
	helper.currentLocation = loc;

	var checkIn = { "radius": radius, "cb_location": loc }; // location and owner are added automatically
	helper.insertDocument("checkins", checkIn, null, function(resp) {
		console.log("CHECK IN Status: " + resp.httpStatus + ", EMsg: " + resp.errorMessage + ", Output: " + resp.outputString);
		if (resp.callStatus) {
			console.log("Checked in at " + pos.toString());
			callback(true);
		} else {
			console.log("Failed to check in");
			callback(false);
		}
	})
}

/**
 * Gets all nearby checkins within the given radius centered on the map's center position
 * callback is a function taking two parameters: a boolean indicating success and an array with check ins
 * (which is empty if the call failed)
 */
function getNearbyCheckins(radius, callback) {
	var pos = map.getCenter();
	
	var search = {
		"cb_location": {
			"$near": [pos.lat(), pos.lng()],
			"$maxDistance": radius
		}
	};
	helper.searchDocuments(search, "checkins", function(resp) {
		console.log("GET NEARBY CHECK INS Status: " + resp.httpStatus + ", EMsg: " + resp.errorMessage + ", Output: " + resp.outputString);
		if (resp.callStatus) {
			console.log("Received checkins");
			callback(true, resp.outputData);
		} else {
			callback(false, []);
		}
	})
}


function setupMap(event,ui) {
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