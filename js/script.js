/**
 * Created by JetBrains PhpStorm.
 * User: altryne
 * Date: 25/5/11
 * Time: 03:42
 */


aelios = {
    o : {
        mapLoaded : 0
        ,firstTime : true
        ,dayOfWeek : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
        ,months : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        ,curDeg : {start:367,end:1080}
        ,degOffset : 90 //deg to start from bottom center
        ,titleWidth : 150,
        pointerPrevAngle : 0,
        cityAjaxTimeout : 0,
        curLoc : {Qa:0,Pa:0},
        nowTime : 1147

    },
    init : function(){
        var map;
        var geocoder;

        //set cached variables
        this.o.$pointerCont = $('#pointerCont');
        this.o.$pointer = $('#pointer');
        this.o.$template= $('#template');

        //set Sounds - using 
        CAAT.AudioManager.initialize(15);
        CAAT.AudioManager.addAudioFromDomNode('click', document.querySelector('#clickSound'));
        CAAT.AudioManager.addAudioFromDomNode('btn', document.querySelector('#btnSound'));

        //create a dummy div to animate canvas with jquery off of it
        $('<div id="one"/>').css({'display':'none','top':this.o.curDeg.end,'left':this.o.curDeg.start}).appendTo('body');
        $('<div id="two"/>').css({'display':'none','top':this.o.nowTime}).appendTo('body');

        //prevent canvas from premature painting, only paint on image load
        aelios.o.img = $('<img/>').attr('src','img/repeat.jpg').load(function(){
            //draw initial light stages on canvas
            aelios.drawLight(aelios.o.curDeg.start,aelios.o.curDeg.end,'nightCanvas');
            aelios.drawLight(aelios.o.curDeg.start,aelios.o.curDeg.end,'dayLightCanvas');

        });
        aelios.o.ptrn = $('<img/>').attr('src','img/ptrn.png').load(function(){
            aelios.drawLight(
                    0,
                    aelios.nowTime,
                    'timeCanvas'
            );
        });
        //set initial rotate states for each shutter piece
        for(var j = 0;j < 24;j++){
            this.o.$template.find('.shutter'+(j+1)).css('rotate',j * 15 + 'deg');
        }
        zodiac.init($('#marker'),$('#rotate'),$('#shutterCont'));
        //initiate google map
        this.createMap();
    },
    createMap : function(){
        //todo:search localstorage for previously set latlng
        var myLatlng = new google.maps.LatLng(51.5085932, -0.1247547);
        var myOptions = {
            zoom: 6,
            center: myLatlng,
            mapTypeId: google.maps.MapTypeId.HYBRID,
            disableDefaultUI: true,
            navigationControlOptions: {
                style:
                        google.maps.NavigationControlStyle.SMALL
            },
            mapTypeControl: false
        }
        geocoder = new google.maps.Geocoder();
        map = new google.maps.Map(document.getElementById("mainmap"), myOptions);
        this.bindMapEvents(map);


    },
    bindMapEvents : function(map){
        google.maps.event.addListener(map, 'dragend', function() {
            aelios.updateCurrentLocation(map.getCenter());
            window.clearInterval(aelios.o.interval);
        });
        google.maps.event.addListener(map, 'drag', function() {
            aelios.animatePointer();
        });
        google.maps.event.addListener(map, 'tilt_changed', function() {
            if(!aelios.o.firstTime){
                aelios.updateCurrentLocation(map.getCenter());
            }
        });
//        google.maps.event.addListener(map, 'zoom_changed', function() {
//            updateCurrentLocation(map.getCenter());
//        });
        google.maps.event.addListener(map, 'dragstart', aelios.dragstarted);
        google.maps.event.addListener(map, 'tilesloaded', function() {
            if(aelios.o.mapLoaded) return false;
            aelios.getBoundingBox();
            aelios.o.mapLoaded = true;
            window.setTimeout(function(){
                aelios.updateCurrentLocation(map.getCenter());
            },1000);
        });
        $('#mylocation').bind('click',function(){
            CAAT.AudioManager.play('btn');
            navigator.geolocation.getCurrentPosition(function(data){
                var myLatlng = new google.maps.LatLng(data.coords.latitude, data.coords.longitude);
                map.setOptions({
                    zoom : 10
                });
                map.panTo(myLatlng);
                aelios.updateCurrentLocation(map.getCenter())
            });
        });
        $('#search').bind('click',aelios.search);
        $('#searchInput').bind('keydown',function(e){
            if(e.keyCode == 13){
                aelios.findLocation($(this).prop('value'));
            }
        });
        $('#overlay').bind('click',aelios.searchOff);
        
    },
    getBoundingBox : function(){
        ov = new google.maps.OverlayView();
        ov.draw = function () {};
        ov.onRemove = function () {};
        ov.setMap(map);
        projection = ov;
        prj = projection.getProjection();
        if(!prj) return;

        var container = $('#boundingBox');
        var padding = $('#boundingBox').width();
        var northeast = prj.fromContainerPixelToLatLng({x:container.offset().left + padding,y:container.offset().top});
        var southwest = prj.fromContainerPixelToLatLng({x:container.offset().left,y:container.offset().top + padding});

        //initial map location finder
        if(!aelios.o.mapLoaded){
            aelios.updateCurrentLocation(map.getCenter());
        }
        return [Math.round(northeast.lng()*100)/100,Math.round(northeast.lat()*100)/100,Math.round(southwest.lng()*100)/100,Math.round(southwest.lat()*100)/100];
    },
    updateCurrentLocation : function(curLoc,stilldragging){
//        check online status
        if(navigator.onLine){
            document.querySelector('body').classList.remove('offline');
        }else{
            document.querySelector('body').classList.add('offline');
        }
        
        aelios.o.curLoc = curLoc || map.getCenter();
        $('#loader').fadeIn();
        //set timeout to use geonames results instead of googles geocoding (much more reliable)
        var timeout = 2000;
        if (geocoder) {
            //get geodocing data from google
            var latlng = aelios.o.curLoc;
              geocoder.geocode({'latLng': latlng}, function(results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    country = results[results.length-1].formatted_address.split(',')[0];
                    place = 'Somewhere...';
                } else {
                    place = 'Somewhere...';
                    country = 'World';
                }
                aelios.o.cityAjaxTimeout = window.setTimeout(function(){
                    //prevent race condition
                    if(!aelios.o.$template.is('.drag')){
                        return;
                    }
                    $('#location').html(place);
                    $('#country').html(country);
                    aelios.o.titleWidth = $('#title').find('.titleCont').width();
                    $('#template').removeClass('drag');
                    aelios.animatePointer();
                    //abort cities ajax request if ran out of time
                    if(citiesAjax) {
                        citiesAjax.abort();
                    }
                },timeout);
              });
            //cancel the rest of this function if function was called on mouse move event
            if(stilldragging) return false;
            //get bset matched city name and location from geonames
            var lat = aelios.o.curLoc.lat();
            var lng = aelios.o.curLoc.lng();
            
            var bounding = aelios.getBoundingBox();
            
            citiesAjax = $.getJSON("http://api.geonames.org/citiesJSON?callback=?",
                    {
                        username: 'altryne',
                        north : bounding[1],
                        east : bounding[0],
                        south : bounding[3],
                        west : bounding[2],
                        maxRows :1,
                        timeout : 200
                    },function(data){
                        if(data.geonames && data.geonames.length > 0){
                            window.clearTimeout(aelios.o.cityAjaxTimeout);
                            delete aelios.o.cityAjaxTimeout;
                            $('#location').html(data.geonames[0].name);
                            $('#country').html(country);
                            $('#template').removeClass('drag');
                            var latlng = new google.maps.LatLng(data.geonames[0].lat, data.geonames[0].lng);
                            aelios.animatePointer(latlng);
                        }else{
                            //set pointer to default location
                            aelios.animatePointer();
                        }
                    }
            );
            //get sunrise and sunset data from geonames
            var jqxhr = $.getJSON("http://ws.geonames.org/timezoneJSON?callback=?",
              {
                  'uID': 1,
                  lat:lat,
                  lng:lng,
                  'username' : 'altryne'
              },
              function(data) {
                  if (data && data.time) {
                      var _date = data.time.split(' ')[0];
                      day = new Date(_date.split('-').join('/'));
                      $('#time').html(data.time.split(' ')[1]);
                      //split datetime to time
                      aelios.updateLightHours(data.sunrise.split(' ')[1],data.sunset.split(' ')[1],data.time.split(' ')[1]);
                      $('#date').html(aelios.o.dayOfWeek[day.getDay()] + ', ' + aelios.o.months[day.getMonth()] + ' ' + day.getDate() + ', ' + day.getFullYear());
                  }
              }
            );
        }
    },
    animatePointer : function(latlng){
        latlng = latlng || false;
        $marker = aelios.o.$pointerCont;
        $pointer = aelios.o.$pointer;
        marker_offset = 15;
        
        if(!aelios.o.$template.is('.drag')){
            aelios.o.pointerPrevLatLng = 0;
        }

        //three way,if new latlng,if old latlang not updated, if no latlng or default position
        //the golder rule ;)
        if(latlng){
            $pointer.removeClass('noanim');
            divpixel = prj.fromLatLngToContainerPixel(latlng);
            pointerx = Math.round(divpixel.x - $marker.offset().left);
            pointery = Math.round(divpixel.y - $marker.offset().top);
            $pointer.animate({top:pointery,left:pointerx},400);
        }else if(aelios.o.pointerPrevLatLng){
            $pointer.addClass('noanim');
            latlng = aelios.o.pointerPrevLatLng;
            divpixel = prj.fromLatLngToContainerPixel(latlng);
            pointerx = Math.round(divpixel.x - $marker.offset().left);
            pointery = Math.round(divpixel.y - $marker.offset().top);
            //calculate how pointer dissappears when outofbounds and reappears
            if(pointerx < marker_offset || pointery < marker_offset || pointerx  + marker_offset > $marker.width() || pointery + marker_offset > $marker.height()){
                if(!$pointer.is('.outOfBounds')){
                    point = aelios.getPointAt(center,radius+marker_offset*3,angle);
                    $pointer.addClass('outOfBounds').animate({top:point.y,left:point.x},400);
                }
                return;
            }else if($pointer.is('.outOfBounds')){
                $pointer.removeClass('outOfBounds').stop()
                .animate({top:pointery,left:pointerx},200);
                return;
            }
            //move position only if pointer isn't animated
            //ipad doesn't seem to be able to drag and change css at the same time. shame
            if(!$pointer.is(':animated')){
                $pointer.css({top:pointery,left:pointerx});
            }

        }else{
            $pointer.removeClass('noanim');
            pointery = $marker.height() / 2;
            pointerx = $marker.width() - ($marker.width() / 2-1);
            $pointer.stop().animate({top:pointery,left:pointerx},400);
        }



        //angle calculations taken straight from http://beradrian.wordpress.com/2009/03/23/calculating-the-angle-between-two-points-on-a-circle/
        center = {x:$marker.width()/2,y:$marker.height()/2};
        p1 = {x : pointerx,y:pointery};
		radius = Math.sqrt(Math.abs(p1.x - center.x) * Math.abs(p1.x - center.x)
                         + Math.abs(p1.y - center.y) * Math.abs(p1.y - center.y));
		p0 = {x: center.x, y: center.y - radius};

        angle = 2 * Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
        distanceAngle = Math.abs(aelios.o.pointerPrevAngle - angle);
        if(distanceAngle > 180){
            angle = aelios.o.pointerPrevAngle - (360 - distanceAngle);
        }
        //debug shit (dot)
//        $('#dot').css({left:pointerx,top:pointery});
//        $pointer[0].style.webkitTransform = 'rotateZ(' + angle + 'deg)';
        $pointer.css('rotate',angle + 'deg');
        aelios.o.pointerPrevAngle = angle;
        aelios.o.pointerPrevLatLng = latlng;
    },
    dragstarted : function(){
        $('#template').addClass('drag');
        aelios.o.interval = window.setInterval(function(){
            if(map.getCenter().lng() == aelios.o.curLoc.lng() && map.getCenter().lat() == aelios.o.curLoc.lat()){
                //didn't move while dragging, no need to update location
            }else{
                //aelios.updateCurrentLocation(map.getCenter());
            }
        },1000);
    },
    updateLightHours : function(beginTime,endTime,nowTime) {

        beginTime = aelios.parseDateTime(beginTime);
        endTime = aelios.parseDateTime(endTime);
        nowTime = aelios.parseDateTime(nowTime);

        //piggyBack on jquery's animate, to animate canvas properties
        $('#one').animate({
            left:beginTime,
            top:endTime
            },{
            duration : 600,
            easing : 'easeOutBack',
            step : function(now,fx){
                aelios.drawLight(
                    parseInt($(this).css('left')),
                    parseInt($(this).css('top'))
                );

            }
        });
        var dir = (aelios.o.nowTime > nowTime) ? -1 : 1;
        var speed = 5;
//        console.log(aelios.o.nowTime ,nowTime);
        if(dir == -1){
            var duration  = -aelios.o.nowTime * speed;
        }else{
            var duration  = (-nowTime + aelios.o.nowTime) * speed;
        }
        $('#two').animate({
                top : nowTime
            },
            {
                duration: Math.abs(duration),
                easing: 'easeOutQuad',
                step : function (){
                    var time = parseInt($(this).css('top'));
                    aelios.drawLight(
                        0,
                        time,
                        'timeCanvas'
                    );
                    $('#hand').css('rotate',parseInt(time * .25,10) + 'deg');
                    if(parseInt(time * .25,10) < 50){
                        aelios.o.$template.addClass('hideRight');
                    }else if(parseInt(time * .25,10) > 290){
                        aelios.o.$template.addClass('hideLeft');
                    }else{
                        aelios.o.$template.removeClass('hideRight hideLeft');
                    }
                },
                complete: function (){
                    aelios.o.nowTime = parseInt($(this).css('top'));
                }
            })
    },
    parseDateTime : function(time){
        var time = time.split(':');
        return parseInt(time[0], 10) * 60 + parseInt(time[1], 10);
    },
    drawLight : function(beginDeg,endDeg,canvasElm){
        canvasElm = canvasElm || 'dayLightCanvas';
        //transform minutes to degrees each minute == 0.25 deg
        //probably there's a smarter way then converting from time to minutes to degrees to radians
        beginDeg =  parseInt(beginDeg * .25,10) - this.o.degOffset;
        endDeg = parseInt(endDeg * .25,10) - this.o.degOffset;

        canvas = document.getElementById(canvasElm);
        context = canvas.getContext("2d");
        context.clearRect(0,0,canvas.offsetWidth,canvas.offsetHeight);
        context.beginPath();
        context.lineWidth = 43;
        centerX = centerY = canvas.offsetWidth / 2;
//        centerY = canvas.offsetHeight / 2;
        radius = canvas.offsetWidth / 2 - context.lineWidth/2;
        //one rad = (PI/180) * deg
        startingAngle = (Math.PI / 180) * beginDeg;
        endingAngle = (Math.PI / 180) * endDeg;
        counterclockwise = false;

        if(canvasElm == 'nightCanvas'){
            
        }else if(canvasElm == 'timeCanvas'){
            context.lineWidth = 40;
            context.arc(centerX, centerY, radius, startingAngle, endingAngle, true);
            ptrn = context.createPattern(aelios.o.ptrn[0],'repeat');
            context.strokeStyle = ptrn; // line color
            context.stroke();
        }else{
            context.arc(centerX, centerY, radius, startingAngle, endingAngle, counterclockwise);
            context.strokeStyle = "white"; // line color
            context.stroke();
        }
    },
    search : function(){
        CAAT.AudioManager.play('btn');
        $('.titleCont').animate({width:300,height:30,marginTop:15},{
            duration:200
        },{
            complete:function(){}
        });
        if($('body').is('.search')){
            aelios.findLocation($('#searchInput').prop('value'));
        }

        $('body').addClass('search');
    },
    searchOff : function(){
        $('body').removeClass('search');
        $('#searchInput').prop('value','');
        $('.titleCont').animate({width:aelios.o.titleWidth,height:50,marginTop:0},{
            duration:200,
            easing: 'swing',
            complete: function(){
                $('.titleCont').width('');
            }
        });

    },
    findLocation : function(address){

        $('#title .titleCont').removeClass('error');
        geocoder.geocode({ 'address': address}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK && address != '') {
                aelios.searchOff();
                map.setCenter(results[0].geometry.location);
                aelios.updateCurrentLocation();
            } else {
                $('#title .titleCont').addClass('error');
                $('#searchInput').prop('value','');
            }
        })
    },
    //helper functions
    getPointAt : function (center, radius, angle) {
        angle *= Math.PI / 180;
        return {x: center.x + Math.sin(Math.PI - angle) * radius,
            y: center.y + Math.cos(Math.PI - angle) * radius};
    }
}

$(document).ready(function(){
    aelios.init();
});


/*! @source http://purl.eligrey.com/github/classList.js/blob/master/classList.js*/
if(typeof document!=="undefined"&&!("classList" in document.createElement("a"))){(function(j){var a="classList",f="prototype",m=(j.HTMLElement||j.Element)[f],b=Object,k=String[f].trim||function(){return this.replace(/^\s+|\s+$/g,"")},c=Array[f].indexOf||function(q){var p=0,o=this.length;for(;p<o;p++){if(p in this&&this[p]===q){return p}}return -1},n=function(o,p){this.name=o;this.code=DOMException[o];this.message=p},g=function(p,o){if(o===""){throw new n("SYNTAX_ERR","An invalid or illegal string was specified")}if(/\s/.test(o)){throw new n("INVALID_CHARACTER_ERR","String contains an invalid character")}return c.call(p,o)},d=function(s){var r=k.call(s.className),q=r?r.split(/\s+/):[],p=0,o=q.length;for(;p<o;p++){this.push(q[p])}this._updateClassName=function(){s.className=this.toString()}},e=d[f]=[],i=function(){return new d(this)};n[f]=Error[f];e.item=function(o){return this[o]||null};e.contains=function(o){o+="";return g(this,o)!==-1};e.add=function(o){o+="";if(g(this,o)===-1){this.push(o);this._updateClassName()}};e.remove=function(p){p+="";var o=g(this,p);if(o!==-1){this.splice(o,1);this._updateClassName()}};e.toggle=function(o){o+="";if(g(this,o)===-1){this.add(o)}else{this.remove(o)}};e.toString=function(){return this.join(" ")};if(b.defineProperty){var l={get:i,enumerable:true,configurable:true};try{b.defineProperty(m,a,l)}catch(h){if(h.number===-2146823252){l.enumerable=false;b.defineProperty(m,a,l)}}}else{if(b[f].__defineGetter__){m.__defineGetter__(a,i)}}}(self))};