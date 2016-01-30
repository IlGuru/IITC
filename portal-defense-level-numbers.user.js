// ==UserScript==
// @id             iitc-plugin-portal-defense-level@ilguru
// @name           IITC plugin: Portal Defense Level
// @category       Layer
// @version        1.0.9.20160130.000011
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      https://raw.githubusercontent.com/IlGuru/IITC/master/portal-defense-level-numbers.meta.js
// @downloadURL    https://raw.githubusercontent.com/IlGuru/IITC/master/portal-defense-level-numbers.user.js
// @description    [ilguru-2016-01-30-000011] Show portal defense level on map.
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @include        https://www.ingress.com/mission/*
// @include        http://www.ingress.com/mission/*
// @match          https://www.ingress.com/mission/*
// @match          http://www.ingress.com/mission/*
// @grant          none
// ==/UserScript==


function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
plugin_info.buildName = 'ilguru';
plugin_info.dateTimeVersion = '20160129.000002';
plugin_info.pluginId = 'portal-defense-level-numbers';
//END PLUGIN AUTHORS NOTE



// PLUGIN START ////////////////////////////////////////////////////////

// use own namespace for plugin
window.plugin.portalDefenseLevelNumbers = function() {
};

window.plugin.portalDefenseLevelNumbers.ICON_SIZE = 12;
window.plugin.portalDefenseLevelNumbers.MOBILE_SCALE = 1.5;

window.plugin.portalDefenseLevelNumbers.levelLayers = {};
window.plugin.portalDefenseLevelNumbers.levelLayerGroup = null;

window.plugin.portalDefenseLevelNumbers.setupCSS = function() {
  $("<style>")
    .prop("type", "text/css")
    .html(".plugin-portal-defense-level-numbers {\
            font-size: 10px;\
            color: #FFFFBB;\
            font-family: monospace;\
            text-align: center;\
            text-shadow: 0 0 0.5em black, 0 0 0.5em black, 0 0 0.5em black;\
            pointer-events: none;\
            -webkit-text-size-adjust:none;\
          }")
  .appendTo("head");
}

window.plugin.portalDefenseLevelNumbers.removeLabel = function(guid) {
  var previousLayer = window.plugin.portalDefenseLevelNumbers.levelLayers[guid];
  if(previousLayer) {
    window.plugin.portalDefenseLevelNumbers.levelLayerGroup.removeLayer(previousLayer);
    delete plugin.portalDefenseLevelNumbers.levelLayers[guid];
  }
}

window.plugin.portalDefenseLevelNumbers.addLabel = function(guid,latLng) {
  // remove old layer before updating
  window.plugin.portalDefenseLevelNumbers.removeLabel(guid);

  // add portal level to layers
  var p = window.portals[guid];
  var d = p.options.details;
  var m;
  var levelNumber = 0;

  debugger;
  
  for each (m in d.mods) {
	  if ( m.name == "Portal Shield" ) {
		//	COMMON
		if ( m.stats.MITIGATION == "30" ) 
			levelNumber = levelNumber + 1;
		//	RARE
		if ( m.stats.MITIGATION == "40" ) 
			levelNumber = levelNumber + 2;
		//	VERY_RARE
		if ( m.stats.MITIGATION == "60" ) 
			levelNumber = levelNumber + 3;
		//	AXA
		if ( m.stats.MITIGATION == "70" ) 
			levelNumber = levelNumber + 4;
	  }
  }
  
  var DefLevel = L.marker(latLng, {
    icon: L.divIcon({
      className: 'plugin-portal-defense-level-numbers',
      iconSize: [window.plugin.portalDefenseLevelNumbers.ICON_SIZE, window.plugin.portalDefenseLevelNumbers.ICON_SIZE],
      html: levelNumber
      }),
    guid: guid
  });
  plugin.portalDefenseLevelNumbers.levelLayers[guid] = DefLevel;
  DefLevel.addTo(plugin.portalDefenseLevelNumbers.levelLayerGroup);
}

window.plugin.portalDefenseLevelNumbers.updatePortalLabels = function() {

  var SQUARE_SIZE = L.Browser.mobile ? (window.plugin.portalDefenseLevelNumbers.ICON_SIZE + 3) * window.plugin.portalDefenseLevelNumbers.MOBILE_SCALE
                                     : (window.plugin.portalDefenseLevelNumbers.ICON_SIZE + 3);

  // as this is called every time layers are toggled, there's no point in doing it when the layer is off
  if (!map.hasLayer(window.plugin.portalDefenseLevelNumbers.levelLayerGroup)) {
    return;
  }

  var portalPoints = {};

  for (var guid in window.portals) {
    var p = window.portals[guid];
    if (p._map && p.options.data.level !== undefined) {  // only consider portals added to the map, and that have a level set
      var point = map.project(p.getLatLng());
      portalPoints[guid] = point;
    }
  }

  // for efficient testing of intersection, group portals into buckets based on the defined rectangle size
  var buckets = {};
  for (var guid in portalPoints) {
    var point = portalPoints[guid];

    var bucketId = L.point([Math.floor(point.x/(SQUARE_SIZE*2)),Math.floor(point.y/SQUARE_SIZE*2)]);
    // the guid is added to four buckets. this way, when testing for overlap we don't need to test
    // all 8 buckets surrounding the one around the particular portal, only the bucket it is in itself
    var bucketIds = [bucketId, bucketId.add([1,0]), bucketId.add([0,1]), bucketId.add([1,1])];
    for (var i in bucketIds) {
      var b = bucketIds[i].toString();
      if (!buckets[b]) buckets[b] = {};
      buckets[b][guid] = true;
    }
  }

  var coveredPortals = {};

  for (var bucket in buckets) {
    var bucketGuids = buckets[bucket];
    for (var guid in bucketGuids) {
      var point = portalPoints[guid];
      // the bounds used for testing are twice as wide as the rectangle. this is so that there's no left/right
      // overlap between two different portals text
      var southWest = point.subtract([SQUARE_SIZE, SQUARE_SIZE]);
      var northEast = point.add([SQUARE_SIZE, SQUARE_SIZE]);
      var largeBounds = L.bounds(southWest, northEast);

      for (var otherGuid in bucketGuids) {
        // do not check portals already marked as covered
        if (guid != otherGuid && !coveredPortals[otherGuid]) {
          var otherPoint = portalPoints[otherGuid];

          if (largeBounds.contains(otherPoint)) {
            // another portal is within the rectangle - remove if it has not a higher level
            if (portals[guid].options.level > portals[otherGuid].options.level) continue;
            else coveredPortals[guid] = true;
            break;
          }
        }
      }
    }
  }

  for (var guid in coveredPortals) {
    delete portalPoints[guid];
  }

  // remove any not wanted
  for (var guid in window.plugin.portalDefenseLevelNumbers.levelLayers) {
    if (!(guid in portalPoints)) {
      window.plugin.portalDefenseLevelNumbers.removeLabel(guid);
    }
  }

  // and add those we do
  for (var guid in portalPoints) {
    window.plugin.portalDefenseLevelNumbers.addLabel(guid, portals[guid].getLatLng());
  }
}

// as calculating portal marker visibility can take some time when there's lots of portals shown, we'll do it on
// a short timer. this way it doesn't get repeated so much
window.plugin.portalDefenseLevelNumbers.delayedUpdatePortalLabels = function(wait) {

  if (window.plugin.portalDefenseLevelNumbers.timer === undefined) {
    window.plugin.portalDefenseLevelNumbers.timer = setTimeout ( function() {
      window.plugin.portalDefenseLevelNumbers.timer = undefined;
      window.plugin.portalDefenseLevelNumbers.updatePortalLabels();
    }, wait*1000);

  }
}

var setup = function() {

  window.plugin.portalDefenseLevelNumbers.setupCSS();

  window.plugin.portalDefenseLevelNumbers.levelLayerGroup = new L.LayerGroup();
  window.addLayerGroup('Portal Defense Levels', window.plugin.portalDefenseLevelNumbers.levelLayerGroup, true);

  window.addHook('requestFinished', function() { setTimeout(function(){window.plugin.portalDefenseLevelNumbers.delayedUpdatePortalLabels(3.0);},1); });
  window.addHook('mapDataRefreshEnd', function() { window.plugin.portalDefenseLevelNumbers.delayedUpdatePortalLabels(0.5); });
  window.map.on('overlayadd overlayremove', function() { setTimeout(function(){window.plugin.portalDefenseLevelNumbers.delayedUpdatePortalLabels(1.0);},1); });

}

// PLUGIN END //////////////////////////////////////////////////////////


setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);


