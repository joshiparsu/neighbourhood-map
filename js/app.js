//
// Global variable required throughout project
//
var map;
var infowindow;
var infoWindows = new Map();

//
// Instead of keeping a static list of places, we will query
// google place service to find out what are the restaurants
// available in nearby area
//
var model = [];

//
// Based on user's choice, we *may* mark some place as favourite
// and in that case, the marker icon will be of green color
//
var orangePin = "img/orange.png";
var bluePin = "img/blue.png";
var greenPin = "img/green.png";

//
// When Google map is loaded, we want to perform some initialization work
// Do it here
//
function initMap() {
    var pune = {lat: 18.513043, lng: 73.832368};
    map = new google.maps.Map(document.getElementById("map"), {
        center: pune,
        zoom: 300
    });

    //
    // We're going to use google place service to find out about
    // nearby restaurants
    //
    var request = {
        location: pune,
        radius: 5000,
        types: ["restaurant"]
    };
    var service = new google.maps.places.PlacesService(map);
    service.nearbySearch(request, serviceCallback);

    infoWindow = new google.maps.InfoWindow();
    //
    // Event listener that closes the Info Window with a click on the map
    //
    google.maps.event.addListener(map, 'click', function() {
        infoWindow.close();
    });

    //
    // When infoWindow is ready, we want to do couple things:
    // 1 - Figure out for which place and marker we're going to show infoWindow
    // 2 - See if selected place is favourite or not
    // 3 - Add checkbox to let user mark/unmark place as favourite
    //
    google.maps.event.addListener(infoWindow, 'domready', function () {
        var latitude = infoWindow.getPosition().lat();
        var markFavourite = "";
        var locationIndex = -1;

        //
        // infoWindow gives us the latitude of it's position
        // We also have latitude of each place that we've found out
        // Compare them to figure out whether that place is already
        // marked as favourite or not
        //
        for (var index = 0; index < model.length; index++) {
            if (model[index].location.lat() == latitude) {
                locationIndex = index;
                if (model[index].favourite === true) {
                    markFavourite = "checked ";
                    break;
                }
            }
        }

        var newContent = '<input type="checkbox" ' +
                        markFavourite +
                        ' onClick="favourite(this, ' + locationIndex + ')"> My favourite';
        //
        // By this time, we're done modifying the infoWindow content.
        // Modify existing content so that infoWindow shows correct info
        //
        var context = infoWindow.getContent();
        infoWindow.setContent(context + newContent);
    });
}

//
// Alert the user in case if google map fails to load
//
function googleError() {
    alert("Google is not responding. Check your connection or come back later.");
}

//
// Go through each result and
// 1 - Push the information to model
// 2 - Get the place details from foursquare.com and cache thats
// 3 - See if the place is marked as favourite
//
function serviceCallback(results, status) {
    if (status == google.maps.places.PlacesServiceStatus.OK) {
        results.forEach(function (place) {
            var p = {};
            p.name = place.name;
            p.location = place.geometry.location;
            p.address = place.formatted_address;
            p.icon = place.icon;
            if (place.photos !== undefined) {
                p.image = place.photos[0].getUrl({ 'maxWidth': 100, 'maxHeight': 100 });
            }
            p.favourite = localStorage.getItem(String(p.location.lat())) === "true" ? true : false;
            model.push(p);
            (function (p) {
                getPlaceDetails(p, function (place, placeName, windowContent) {
                    infoWindows.set(place.location.lat(), windowContent);
                });
            })(p);
        });
    }
    else {
        alert("Failed to find near by restaurant. Try again later.");
    }

    createMarkers();
    ko.applyBindings(new viewModel());
}

//
// In infoWinow, user may mark or unmark a place as favourite
// In that case, we want to
// 1 - Mark the place as favourite or not based on checkbox state
// 2 - Change the marker icon
// 3 - Mark or unmark the place as favourite on browser local storage
//
function favourite(element, index) {
    model[index].favourite = element.checked;
    model[index].marker.setAnimation(google.maps.Animation.BOUNCE);
    model[index].marker.setIcon(model[index].favourite ? greenPin : bluePin);
    model[index].marker.setAnimation(null);
    if (model[index].favourite) {
        localStorage.setItem(String(model[index].location.lat()), String(model[index].favourite));
    }
    else {
        localStorage.removeItem(String(model[index].location.lat()));
    }
}

//
// Go through each place in the list and create marker for
// individual place
// Also fit the map bounds to cover appropriate map area
//
function createMarkers() {
    var bounds = new google.maps.LatLngBounds();
    model.forEach(function (currentModel) {
        createMarker(currentModel);
        bounds.extend(currentModel.location);
    });
    map.fitBounds(bounds);
}

//
// This function creates each marker and it sets their Info Window content
//
function createMarker(place) {
    var marker = new google.maps.Marker({
        map: map,
        position: place.location,
        title: place.name,
        icon: place.favourite ? greenPin : bluePin,
        animation: google.maps.Animation.DROP
    });
    place.marker = marker;
    
    //
    // When someone clicks on marker, open associated infoWindow
    //
    google.maps.event.addListener(marker, 'click', function() {
        var self = this;
        infoWindow.setContent(infoWindows.get(place.location.lat()));
        infoWindow.open(map, self);
        toggleBounce(self);
        setTimeout(stopBounce, 1400);
        function stopBounce() {
            self.setAnimation(null);
            if (place.favourite === true) {
                self.setIcon(greenPin);
            }
            else {
                self.setIcon(bluePin);
            }
        }
    });
}

//
// Based on the location, query 'foursquare.com' to get
// details about it. The details of the place will be
// displayed in the associated infoWindow
//
function getPlaceDetails(location, infoWindowCallback) {
    var fourquareUrl = "https://api.foursquare.com/v2/venues/search?";
    var clientId = "UYMYBDKWICLXSYRDBNZEUR2PGWMBKA5IEVPE13MH0O3NNURU";
    var clientSecret = "A1TSWCWFFKDPKONMUB5RLKPH0WRM5F1YGQUIECX1LMDOLBHC";
    
    venueName = location.name.replace(/ /g, "&");
    latitude = (location.location.lat());
    longitude = (location.location.lng());

    requestUrl = fourquareUrl +
                 '&client_id=' + clientId +
                 '&client_secret=' + clientSecret +
                 '&v=20161016&query=' + venueName +
                 '&ll=' + latitude + ',' + longitude;

    $.ajax(requestUrl)
        .success(function(data) {
            var venue = data.response.venues[0];
            var placeName = venue.name;
            var placeAddress = venue.location.formattedAddress;
            var placePhonenos = (venue.contact.formattedPhone === undefined)? 'None': venue.contact.formattedPhone;
            var placeType = (venue.categories[0].name === undefined) ? 'None' : venue.categories[0].name; 
            var placePhoto = location.image === undefined ? ' ' : location.image;
            windowContent = '<div id="iw_container">' +
                            '<p><img width="50" height="50" src="' +  placePhoto + '">' +
                            '<img width="25" height="25" src="' + location.icon + ' ">' +
                            '<strong>Name: </strong>' + placeName + '</p>' +
                            '<p><strong>Address: </strong>  ' + placeAddress + '</p>' +
                            '<p><strong>Phone: </strong>' + placePhonenos + '</p>' +
                            '<p><strong>Type: <strong>' + placeType + '</p>' + 
                            '</div>';
            infoWindowCallback(location, placeName, windowContent);
        }).fail(function(xhr, error, status) {
            windowContent = 'Fail to connect to Foursquare';
            infoWindowCallback(location, "", windowContent);
            console.log("Failed for " + location.name);
    });
}

//
// When user clicks on marker, we want show some effects
//
function toggleBounce(marker) {
    if (marker.getAnimation() !== null) {
        marker.setAnimation(null);
    } else {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        marker.setIcon(orangePin);
    }
}

var place = function(data) {
    this.name = ko.observable(data.name);
    this.address = ko.observable(data.address);
    this.location = ko.observable(data.location);
    this.marker = ko.observable(data.marker);
};

//
// viewModel that associates our model data, the places that should
// be displayed in the list and filter it based on user input if requireds
//
var viewModel = function() {
    var self = this;
    //
    // Place name typed in the search textbox
    //
    self.query = ko.observable('');

    self.allPlaces = ko.observableArray([]);
    model.forEach(function (place) {
        self.allPlaces.push(place);
    });

    //
    // When the user tries to search a place, the visible places are reduced 
    // based on the query. Maintain that list as well.
    // Initially, all the places are visible
    //
    self.visiblePlaces = ko.observableArray();
    self.allPlaces().forEach(function(place) {
        self.visiblePlaces.push(place);
    });

    //
    // When user clicks on particular place, show the associated place in the map
    //
    self.clickOnVisiblePlace = function(place, marker) {
        google.maps.event.trigger(place.marker, 'click');
    };

    //
    // Filter the places as per user query
    //
    self.filterMarkers = function() {
        var filter = self.query().toLowerCase();
        self.visiblePlaces.removeAll();
        infoWindow.close();

        //
        // Go through list of all the places and see if user query matches
        // with any of them.
        //
        self.allPlaces().forEach(function(place) {
            place.marker.setVisible(false);
            if (place.name.toLowerCase().indexOf(filter) !== -1) {
                self.visiblePlaces.push(place);
            }
        });

        //
        // Show the marker of the visible which is now a filter list
        // as per user query
        //
        self.visiblePlaces().forEach(function(place) {
            place.marker.setVisible(true);
        });
    };
};