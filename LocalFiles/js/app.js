/*
	Main js file
*/
var map;

/** Cloudbase helper object */
var helper;

var pushManager = new PushNotificationManager();
var pushToken;

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

function handleAddFriend() {
	$.mobile.changePage("#addFriend-page","slideright");
}

function initialize () {
	$("#map-page").on('pageshow', setupMap);
	$("#loginButton").on("click",handleLogin);
	$("#logoutButton").on("click",handleLogout);
	$(".meButton").on("click", handleMe);
	$(".mapButton").on("click", handleMap);
	$(".friendsButton").on("click", handleFriends);
	$("#addFriendButton").on("click", handleAddFriend);
}

function initCB() {
	if (!helper) {
		var moSyncHelper = new MoSyncHelper();
		helper = new CBHelper("chatin", "bb1cab8b28f7f7551c74591fe4c81332", moSyncHelper);
		helper.setPassword(hex_md5("mopub13project"));

		pushManager.register(function(token) {
			pushToken = token;
		}, function(error) {
			console.log("Failed to set up push: " + JSON.stringify(error);
		});
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
				if (localStorage)
					localStorage["chatin_user"] = user;
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
				if (localStorage)
					localStorage["chatin_user"] = user;
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
	var loc = new CBHelperCurrentLocation(currentPosition.coords.latitude,
		currentPosition.coords.longitude, currentPosition.coords.altitude);
	helper.currentLocation = loc;

	var checkIn = { "radius": radius }; // location and owner are added automatically
	helper.insertDocument("checkins", checkIn, null, function(resp) {
		console.log("CHECK IN Status: " + resp.httpStatus + ", EMsg: " + resp.errorMessage + ", Output: " + resp.outputString);
		if (resp.callStatus) {
			console.log("Checked in at " + pos.toString());
			if (pushToken) {
				helper.sendNotification("My position is " + pos.toString(), "nearby_" + user.username, "development");
			}

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
			"$near": [currentPosition.coords.latitude, currentPosition.coords.longitude],
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
	});
}

/**
 * Gets the friends for the currently logged in user. callback is a function taking a boolean (success)
 * and an array with friends' user names (which is empty if the call failed)
 */
function getFriends(callback) {
	helper.searchDocuments({ "username": user.username }, "users", function(resp) {
		console.log("GET FRIENDS Status: " + resp.httpStatus + ", EMsg: " + resp.errorMessage + ", Output: " + resp.outputString);
		if (resp.callStatus && resp.outputData.length > 0) {
			console.log("Received friends");
			callback(true, resp.outputData[0].friends);
		} else {
			callback(false, []);
		}
	});
}

/**
 * Given a friend's username, adds this friend to the currently logged in user's friends list.
 * Does not check that the friend's name is a valid username nor if it exists in the friends list previously.
 * callback is a function taking a boolean indicating success.
 */
function addFriend(friendUsername, callback) {
	helper.searchDocuments({ "username": user.username }, "users", function(resp) {
		if (!resp.callStatus)
			return callback(false);

		var newUser = resp.outputData[0];
		newUser.friends.push(friendUsername);
		helper.updateDocument(newUser, { "username": user.username }, "users", null, function(updResp) {
			if (!updResp.callStatus)
				return callback(false);
			console.log("Successfully added friend");
			callback(true);
		});
	});
}

/**
 * Registers this device for check in notifications
 */
function setupCheckinNotifications() {
	helper.registerDeviceForNotifications(pushToken, "nearby_" + user.username, function(result) {
		console.log("Registered for checkin notifications");
	});
}


var currentPosition = null;
function setupMap(event,ui) {
	var pos;
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(function(position) {
			currentPosition = position;
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