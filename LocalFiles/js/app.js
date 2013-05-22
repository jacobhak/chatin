/*
    Main js file
*/
var map;
var markers = {}; // Object linking checkin user name => marker object

/** Cloudbase helper object */
var helper;

/** PubNub object */
var pubnub;

function handleLogin() {
    var username = $("#email").val();
    var password = hex_md5($("#password").val());
    console.log("got user: "+username+" pass: "+password);
    loginOrRegister(username, password, function(success){
        if (success) {
            $.mobile.changePage("#map-page");

            // Subscribe to nearby checkins in pubnub
            pubnub.subscribe({
                "channel": "nearby_" + username,
                "callback": receivedNearbyCheckin
            });

        } else {
            $("#placeholder").append("Login or register failed");
        }
    });
}

function handleCheckIn () {
    checkIn(10000, function(success){
        if (success)
            putCheckinsOnMap();
    });
}

function handleLogout() {
	delete localStorage["chatin_username"];
	delete localStorage["chatin_password"];
    $.mobile.changePage("#loginOrRegister-page");
}

function handleMe() {
    $.mobile.changePage("#me-page");
}

function handleMap() {
    $.mobile.changePage("#map-page");
}

function handleChats() {
    $.mobile.changePage("#chats-page");
    getNearbyCheckins(100, function(success, checkins){
        if (!success) {
            alert("Failed to get nearby checkins");
            return;
        }
        $("#chats-content ul").children().remove();
        for (var i = 0; i < checkins.length; i++) {
            $("#chats-content ul").append('<li id="chat'+i+'">'+ checkins[i].cb_owner_user + "'s chat" + '</li>');
        }
        $("#chats-content ul").children().on("click", function(e){
            var jodu = e.target.id.slice(-1, e.target.id.length);
            setupChatView(checkins[jodu]);
        });
        $("#chats-content ul").listview('refresh');
    });
}

function setupChatView(checkin) {
    $.mobile.changePage("#chat-view", "slideright");
    updateChatView(checkin);
    $("#sendMessageButton").off("click").on("click", function() {
        if ($("#chatText").val().length !== 0) {
            sendMessageToChat(checkin, $("#chatText").val());
            $("#chatText").val("");
            //updateChatView(checkin);
        }
    });
}

function updateChatView(checkin) {
    getChat(checkin,function(history){
        console.log(history);
        $("#chat-content ul").children().remove();
        for (var i = 0; i < history[0].length; i++)
            $("#chat-content ul").append('<li>'+ history[0][i] + '</li>');
        $("#chat-content ul").listview("refresh");
        $("html, body").animate({
	        	scrollTop: $(document).height()
	        }, 400);
    }, function(message){
        console.log(message);
        $("#chat-content ul").append('<li>' + message + '</li>');
        $("#chat-content ul").listview("refresh");
        $("html, body").animate({
	        	scrollTop: $(document).height() - $(window).height()
	        }, 200);
    });
}

function handleFriends() {
    $.mobile.changePage("#friends-page");
    getFriends(function(success, friends) {
        if (!success) {
            alert("Failed to get friends list");
            return;
        }

        $("#friends-content ul").children().remove();
        for (var i = 0; i < friends.length; i++)
            $("#friends-content ul").append('<li>' + friends[i] + '</li>');


        $("#friends-content ul").listview('refresh');
    });
}

function handleAddFriend() {
    $.mobile.changePage("#addFriend-page","slideright");
    $("#confirmFriendButton").off("click").on("click", function() {
        if ($("#friendName").val().length == 0) 
            return;

        addFriend($("#friendName").val(), function(success) {
            if (!success)
                alert("Failed to add friend");
            else
                alert("Friend added");

            handleFriends();
        });
    })
}

function initialize () {
    $("#map-page").on('pageshow', setupMap);
    $("#loginButton").on("click",handleLogin);
    $("#logoutButton").on("click",handleLogout);
    $(".meButton").on("click", handleMe);
    $(".mapButton").on("click", handleMap);
    $(".friendsButton").on("click", handleFriends);
    $(".chatsButton").on("click", handleChats);
    $("#addFriendButton").on("click", handleAddFriend);
    $("#checkInButton").on("click", handleCheckIn);
}

function initCB() {
    if (!helper) {
        var moSyncHelper = new MoSyncHelper();
        helper = new CBHelper("chatin", "bb1cab8b28f7f7551c74591fe4c81332", moSyncHelper);
        helper.setPassword(hex_md5("mopub13project"));
    }

    pubnub = PUBNUB.init({
        publish_key   : "pub-c-ed04a441-0a05-49c6-b6d6-59254aa8e0f6",
        subscribe_key : "sub-c-0d9718ca-bc8c-11e2-b159-02ee2ddab7fe"
    });

    if (localStorage && localStorage["chatin_username"]) {
    	loginOrRegister(localStorage["chatin_username"], localStorage["chatin_password"], function(success) {
    		if (success) {
    		    $.mobile.changePage("#map-page");

    		    // Subscribe to nearby checkins in pubnub
    		    pubnub.subscribe({
    		        "channel": "nearby_" + localStorage["chatin_username"],
    		        "callback": receivedNearbyCheckin
    		    });

    		} else {
    		    delete localStorage["chatin_username"];
    		    delete localStorage["chatin_password"];
    		}
    	});
    }
}

/** User authentication */
var user;

/**
 * Attempts to log in as the given user in username with MD5'd password.
 * If there is no user with that username, a new one is created.
 * callback is a function taking a boolean indicating success (user logged in or was registered)
 */
function loginOrRegister(username, password, callback) {
    console.log("Login or register, username = " + username + ", password = " + password);
    var tmpUser = { "username": username, "password": password };
    helper.authUsername = username;
    helper.authPassword = password;

    helper.searchDocuments(tmpUser, "users", function(resp) {
        console.log("LOG IN Status: " + resp.httpStatus + ", EMsg: " + resp.errorMessage + ", Output: " + resp.outputString);
        if (resp.callStatus) {
            console.log("Successful search");
            // Successful search
            if (resp.outputData.length > 0) {
                // Correct username and password
                user = tmpUser;
                if (localStorage) {
                    localStorage["chatin_username"] = user.username;
                    localStorage["chatin_password"] = user.password;
                }
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
                if (localStorage) {
                    localStorage["chatin_username"] = user.username;
                    localStorage["chatin_password"] = user.password;
                }
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

    var checkIn = { "cb_owner_user": user.username, "radius": radius }; // location and owner are added automatically
    
    // myCheckIn is the JSON object sent over PubNub to nearby users
    var myCheckIn = {
        "cb_owner_user": user.username,
        "radius": radius,
        "cb_location": {
            "lat": currentPosition.coords.latitude,
            "lng": currentPosition.coords.longitude
        }
    };

    /* After we've checked in, we want to find users nearby who checked in and let them know.
     * This function is used as the callback to getNearbyCheckins. */
    var informNearbyCheckins = function(success, checkins) {
        if (!success || checkins.length == 0) return;

        for (var i = 0; i < checkins.length; i++) {
            if (checkins[i].cb_owner_user != user.username) {
                console.log("Informing "+checkins[i].cb_owner_user + " of my check in: " + myCheckIn);
                pubnub.publish({
                    "channel": "nearby_" + checkins[i].cb_owner_user,
                    "message": JSON.stringify(myCheckIn)
                });
            }
        }
    }

    var search = { "cb_owner_user": user.username };
    // Check if this user already has a check in, if so, move it
    helper.searchDocuments(search, "checkins", function(resp) {
        if (resp.callStatus && resp.outputData.length > 0) {
            // Update existing check in
            helper.updateDocument(checkIn, search, "checkins", null, function(updResp) {
                if (updResp.callStatus) {
                    console.log("Updated existing checkin");
                    getNearbyCheckins(radius, informNearbyCheckins);
                    callback(true);
                } else {
                    console.log("Failed to update existing checkin");
                    callback(false);
                }                                       
            });
        } else {
            // No existing check in
            helper.insertDocument("checkins", checkIn, null, function(resp) {
                console.log("INSERT CHECK IN Status: " + resp.httpStatus + ", EMsg: " + resp.errorMessage + ", Output: " + resp.outputString);
                if (resp.callStatus) {
                    console.log("Checked in at " + pos.toString());
                    getNearbyCheckins(radius, informNearbyCheckins);
                    callback(true);
                } else {
                    console.log("Failed to check in");
                    callback(false);
                }
            });
        }
    });
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
 * Automatically called by PubNub when a new checkin has been received from someone nearby.
 */
function receivedNearbyCheckin(checkin) {
    console.log("Received nearby checkin " + checkin);
    //alert("GOT CHECKIN "+checkin);
    var checkinObj = JSON.parse(checkin);
	var pos = new google.maps.LatLng(checkinObj.cb_location.lat, checkinObj.cb_location.lng);
    var marker = new google.maps.Marker({
        position: pos,
        map: map,
        title:"Hi"
    });

    if (markers[checkin.cb_owner_user] != null)
    	markers[checkin.cb_owner_user].setMap(null);
    markers[checkin.cb_owner_user] = marker;
}

/**
 * Gets the chat for a given checkIn object. The checkIn object must have cb_location and cb_owner
 * properties. historyCallback is a function called by PubNub when fetching the initial chat history, and
 * takes an array where the first element is itself an array of previous messages.
 * messageCallback is a function taking a string and is called for every new message.
 */
function getChat(checkIn, historyCallback, messageCallback) {
    var channelName = checkIn.cb_owner_user + '_' + hex_md5(checkIn.cb_location.lat + ',' + checkIn.cb_location.lng);
    pubnub.subscribe({
        'channel': channelName,
        'callback': messageCallback
    });
    pubnub.history({
        'channel': channelName,
        'count': 20,
        'callback': historyCallback
    });
}

/**
 * Given a checkIn and a string message, sends the message to the chat for that checkIn (must have cb_location
 * and cb_owner). The message is automatically prefixed with the user's username.
 */
function sendMessageToChat(checkIn, message) {
    var channelName = checkIn.cb_owner_user + '_' + hex_md5(checkIn.cb_location.lat + ',' + checkIn.cb_location.lng);
    pubnub.publish({
        'channel': channelName,
        'message': user.username + ': ' + message
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
    currentPosition = { "coords": { "latitude": 59.347283, "longitude": 18.073668}};
    pos = new google.maps.LatLng(59.347283,18.073668);

    var mapOptions = {
        center: pos,
        zoom: 18,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
    putCheckinsOnMap();
}

var infowindow = new google.maps.InfoWindow();

function putCheckinsOnMap() {
    getNearbyCheckins(100, function (success, checkins) {
        if (success) {
            var pos;
            for (var i = checkins.length - 1; i >= 0; i--) {
                pos = new google.maps.LatLng(checkins[i].cb_location.lat, checkins[i].cb_location.lng);
                var marker = new google.maps.Marker({
                    position: pos,
                    map: map,
                    title:"Hi"
                });
                if (checkins[i].cb_owner_user == user.username) {
                	// If this is our marker, we want a different icon
                	marker.setIcon({
                		"path": google.maps.SymbolPath.CIRCLE,
                		"scale": 14,
                		"strokeColor": "#ff0000",
                		"strokeWeight": 3
                	})
                }
                if (markers[checkins[i].cb_owner_user] != null)
                	markers[checkins[i].cb_owner_user].setMap(null);
               	markers[checkins[i].cb_owner_user] = marker;
                makeInfoWindowEvent(map, infowindow, checkins[i].cb_owner_user, marker);
            }

        }
    });
}
function makeInfoWindowEvent(map, infowindow, contentString, marker) {
  google.maps.event.addListener(marker, 'click', function() {
    infowindow.setContent(contentString);
    infowindow.open(map, marker);
  });
}