//=========================================================================
// minimalist DOM helpers
//=========================================================================

var Dom = {
    get: function(id) {
        return ((id instanceof HTMLElement) || (id === document)) ? id : document.getElementById(id);
    },
    set: function(id, html) { Dom.get(id).innerHTML = html; },
    on: function(ele, type, fn, capture) { Dom.get(ele).addEventListener(type, fn, capture); },
    un: function(ele, type, fn, capture) { Dom.get(ele).removeEventListener(type, fn, capture); },
    show: function(ele, type) { Dom.get(ele).style.display = (type || 'block'); },
    blur: function(ev) { ev.target.blur(); },
    addClassName: function(ele, name) { Dom.toggleClassName(ele, name, true); },
    removeClassName: function(ele, name) { Dom.toggleClassName(ele, name, false); },
    toggleClassName: function(ele, name, on) {
        ele = Dom.get(ele);
        var classes = ele.className.split(' ');
        var n = classes.indexOf(name);
        on = (typeof on == 'undefined') ? (n < 0) : on;
        if (on && (n < 0))
            classes.push(name);
        else if (!on && (n >= 0))
            classes.splice(n, 1);
        ele.className = classes.join(' ');
    }
}

//=========================================================================
// general purpose helpers (mostly math)
//=========================================================================

var Util = {
    timestamp: function() {
        return new Date().getTime();
    },
    toInt: function(obj, def) {
        if (obj !== null) {
            var x = parseInt(obj, 10);
            if (!isNaN(x)) return x;
        }
        return Util.toInt(def, 0);
    },
    toFloat: function(obj, def) {
        if (obj !== null) {
            var x = parseFloat(obj);
            if (!isNaN(x)) return x;
        }
        return Util.toFloat(def, 0.0);
    },
    limit: function(value, min, max) {
        return Math.max(min, Math.min(value, max));
    },
    randomInt: function(min, max) {
        return Math.round(Util.interpolate(min, max, Math.random()));
    },
    randomChoice: function(options) {
        return options[Util.randomInt(0, options.length - 1)];
    },
    percentRemaining: function(n, total) {
        return (n % total) / total;
    },
    accelerate: function(v, accel, dt) {
        return v + (accel * dt);
    },
    interpolate: function(a, b, percent) {
        return a + (b - a) * percent
    },
    easeIn: function(a, b, percent) {
        return a + (b - a) * Math.pow(percent, 2);
    },
    easeOut: function(a, b, percent) {
        return a + (b - a) * (1 - Math.pow(1 - percent, 2));
    },
    easeInOut: function(a, b, percent) {
        return a + (b - a) * ((-Math.cos(percent * Math.PI) / 2) + 0.5);
    },
    increase: function(start, increment, max) { // with looping
        var result = start + increment;
        while (result >= max)
            result -= max;
        while (result < 0)
            result += max;
        return result;
    },
    project: function(p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
        p.camera.x = (p.world.x || 0) - cameraX;
        p.camera.y = (p.world.y || 0) - cameraY;
        p.camera.z = (p.world.z || 0) - cameraZ;
        p.screen.scale = cameraDepth / p.camera.z;
        p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
        p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
        p.screen.w = Math.round((p.screen.scale * roadWidth * width / 2));
    },
    overlap: function(x1, w1, x2, w2, percent) {
        var half = (percent || 1) / 2;
        var min1 = x1 - (w1 * half);
        var max1 = x1 + (w1 * half);
        var min2 = x2 - (w2 * half);
        var max2 = x2 + (w2 * half);
        return !((max1 < min2) || (min1 > max2));
    }
}

//=========================================================================
// POLYFILL for requestAnimationFrame
//=========================================================================

if (!window.requestAnimationFrame) { // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    window.requestAnimationFrame = window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function(callback, element) {
            window.setTimeout(callback, 1000 / 60);
        }
}

//=========================================================================
// GAME LOOP helpers
//=========================================================================

var fps = 60;
var segmentLength = 200;
var step = 1 / fps; // fixed frame step (1/fps) is specified by caller
var maxSpeed = segmentLength / step;
var accel = maxSpeed / 5; // acceleration rate - tuned until it 'felt' right
var breaking = -maxSpeed; // deceleration rate when braking
var decel = -maxSpeed / 5; // 'natural' deceleration rate when neither accelerating, nor braking
var offRoadDecel = -maxSpeed / 2; // off road deceleration is somewhere in between
var offRoadLimit = maxSpeed / 4;
var now = null;
var last = Util.timestamp();
var dt = 0;
var background;
var sprites;
var width = 350; // logical canvas width
var height = 300; // logical canvas height
var resolution = null; // scaling factor to provide resolution independence (computed)
var roadWidth = 2000; // actually half the roads width
var rumbleLength = 3; // number of segments per red/white rumble strip
var lanes = 3; // number of lanes
var fieldOfView = 100; // angle (degrees) for field of view
var cameraHeight = 1000; // z height of camera
var cameraDepth = null; // z distance camera is from screen (computed)
var drawDistance = 300; // number of segments to draw

function Game(canvas, id) {
    this.gdt = 0;
    this.id = id;
    this.playerX = 0;
    this.playerZ = null;
    this.speed = 0;
    this.canvas = Dom.get(canvas);
    this.position = 0;
    this.segments = [];
    this.trackLength = null;
    this.keyFaster = false;
    this.keySlower = false;
}

Game.prototype.findSegment = function(z) {
    return this.segments[Math.floor(z / segmentLength) % this.segments.length];
}

Game.prototype.run = function(options) {
    var currentGame = this;
    var canvas = this.canvas;
    this.loadImages(options.images, function(images) {
        background = images[0];
        sprites = images[1];
    });
    this.reset();
    // Set up Key listeners
    this.setKeyListener([{
        keys: [KEY.UP1],
        id: 1,
        mode: 'down',
        action: function() {
            currentGame.keyFaster = true;
        }
    }, {
        keys: [KEY.DOWN1],
        id: 1,
        mode: 'down',
        action: function() {
            currentGame.keySlower = true;
        }
    }, {
        keys: [KEY.UP2],
        id: 2,
        mode: 'down',
        action: function() {
            currentGame.keyFaster = true;
        }
    }, {
        keys: [KEY.DOWN2],
        id: 2,
        mode: 'down',
        action: function() {
            currentGame.keySlower = true;
        }
    }, {
        keys: [KEY.UP1],
        id: 1,
        mode: 'up',
        action: function() {
            currentGame.keyFaster = false;
        }
    }, {
        keys: [KEY.DOWN1],
        id: 1,
        mode: 'up',
        action: function() {
            currentGame.keySlower = false;
        }
    }, {
        keys: [KEY.UP2],
        id: 2,
        mode: 'up',
        action: function() {
            currentGame.keyFaster = false;
        }
    }, {
        keys: [KEY.DOWN2],
        id: 2,
        mode: 'up',
        action: function() {
            currentGame.keySlower = false;
        }
    }]);

    function frame() {
        now = Util.timestamp();
        dt = Math.min(1, (now - last) / 1000); 
        currentGame.gdt = currentGame.gdt + dt;
        currentGame.update(step);
        currentGame.render();
        last = now;
        requestAnimationFrame(frame, canvas);
    }
    frame();
};

Game.prototype.update = function(dt) {
    this.position = Util.increase(this.position, dt * this.speed, this.trackLength);
    var dx = dt * 2 * (this.speed / maxSpeed);
    if (this.keyFaster)
        this.speed = Util.accelerate(this.speed, accel, dt);
    else if (this.keySlower)
        this.speed = Util.accelerate(this.speed, breaking, dt);
    else
        this.speed = Util.accelerate(this.speed, decel, dt);
    if (((this.playerX < -1) || (this.playerX > 1)) && (this.speed > offRoadLimit))
        this.speed = Util.accelerate(this.speed, offRoadDecel, dt);
    this.playerX = Util.limit(this.playerX, -2, 2); 
    this.speed = Util.limit(this.speed, 0, maxSpeed); 
};

Game.prototype.render = function() {
    var ctx = this.canvas.getContext('2d');
    var speed = this.speed;
    var baseSegment = this.findSegment(this.position);
    var maxy = height;
    ctx.clearRect(0, 0, width, height);

    // Render.background(ctx, background, width, height, BACKGROUND.SKY);
    // Render.background(ctx, background, width, height, BACKGROUND.HILLS);
    // Render.background(ctx, background, width, height, BACKGROUND.TREES);

    var n, segment;

    for (n = 0; n < drawDistance; n++) {
        segment = this.segments[(baseSegment.index + n) % this.segments.length];
        segment.looped = segment.index < baseSegment.index;

        Util.project(segment.p1, (this.playerX * roadWidth), cameraHeight, this.position - (segment.looped ? this.trackLength : 0), cameraDepth, width, height, roadWidth);
        Util.project(segment.p2, (this.playerX * roadWidth), cameraHeight, this.position - (segment.looped ? this.trackLength : 0), cameraDepth, width, height, roadWidth);

        if ((segment.p1.camera.z <= cameraDepth) || // behind us
            (segment.p2.screen.y >= maxy)) // clip by (already rendered) segment
            continue;

        Render.segment(ctx, width, lanes,
            segment.p1.screen.x,
            segment.p1.screen.y,
            segment.p1.screen.w,
            segment.p2.screen.x,
            segment.p2.screen.y,
            segment.p2.screen.w,
            segment.color);

        maxy = segment.p2.screen.y;
    }

    Render.player(ctx, width, height, resolution, roadWidth, sprites, speed / maxSpeed,
        cameraDepth / this.playerZ,
        width / 2,
        height,
        speed,
        0);
};

//---------------------------------------------------------------------------

Game.prototype.loadImages = function(names, callback) { // load multiple images and callback when ALL images have loaded
    // var result = [];
    // var count = names.length;

    // var onload = function() {
    //     if (--count == 0)
    //         callback(result);
    // };

    // for (var n = 0; n < names.length; n++) {
    //     var name = names[n];
    //     result[n] = document.createElement('img');
    //     Dom.on(result[n], 'load', onload);
    //     result[n].src = "images/" + name + ".png";
    // }

    // HACKY CODE!
    background = document.createElement('img');
    background.src = "images/background/background.png";
    sprites = document.createElement('img');
    sprites.src = "images/sprites/sprites.png";
};

//---------------------------------------------------------------------------

Game.prototype.setKeyListener = function(keys) {
    var self = this;

    var onkey = function(keyCode, mode) {
        var n, k;
        for (n = 0; n < keys.length; n++) {
            k = keys[n];
            k.mode = k.mode || 'up';
            if (k.id === self.id) {

                if ((k.key == keyCode) || (k.keys && (k.keys.indexOf(keyCode) >= 0))) {
                    if (k.mode == mode) {
                        k.action.call();
                    }
                }
            }
        }
    };

    Dom.on(document, 'keydown', function(ev) {
        onkey(ev.keyCode, 'down');
    });
    Dom.on(document, 'keyup', function(ev) {
        onkey(ev.keyCode, 'up');
    });
};

//---------------------------------------------------------------------------



Game.prototype.reset = function(options) {
    options = options || {};
    this.canvas.width = width = Util.toInt(options.width, width);
    this.canvas.height = height = Util.toInt(options.height, height);
    lanes = Util.toInt(options.lanes, lanes);
    roadWidth = Util.toInt(options.roadWidth, roadWidth);
    cameraHeight = Util.toInt(options.cameraHeight, cameraHeight);
    drawDistance = Util.toInt(options.drawDistance, drawDistance);
    fieldOfView = Util.toInt(options.fieldOfView, fieldOfView);
    segmentLength = Util.toInt(options.segmentLength, segmentLength);
    rumbleLength = Util.toInt(options.rumbleLength, rumbleLength);
    cameraDepth = 1 / Math.tan((fieldOfView / 2) * Math.PI / 180);
    this.playerZ = (cameraHeight * cameraDepth);
    resolution = height / 480;

    // Refresh UI
    Dom.get('lanes').selectedIndex = lanes - 1;
    Dom.get('currentRoadWidth').innerHTML = Dom.get('roadWidth').value = roadWidth;
    Dom.get('currentCameraHeight').innerHTML = Dom.get('cameraHeight').value = cameraHeight;
    Dom.get('currentDrawDistance').innerHTML = Dom.get('drawDistance').value = drawDistance;
    Dom.get('currentFieldOfView').innerHTML = Dom.get('fieldOfView').value = fieldOfView;

    if ((this.segments.length == 0) || (options.segmentLength) || (options.rumbleLength)) {
        this.resetRoad(); // only rebuild road when necessary
    }
};

Game.prototype.resetRoad = function() {
    this.segments = [];
    for (var n = 0; n < 500; n++) {
        this.segments.push({
            index: n,
            p1: {
                world: {
                    z: n * segmentLength
                },
                camera: {},
                screen: {}
            },
            p2: {
                world: {
                    z: (n + 1) * segmentLength
                },
                camera: {},
                screen: {}
            },
            color: Math.floor(n / rumbleLength) % 2 ? COLORS.DARK : COLORS.LIGHT
        });
    }

    this.segments[this.findSegment(this.playerZ).index + 2].color = COLORS.START;
    this.segments[this.findSegment(this.playerZ).index + 3].color = COLORS.START;
    for (var n = 0; n < rumbleLength; n++)
        this.segments[this.segments.length - 1 - n].color = COLORS.FINISH;

    this.trackLength = this.segments.length * segmentLength;
}

//=========================================================================
// canvas rendering helpers
//=========================================================================

var Render = {

    polygon: function(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.closePath();
        ctx.fill();
    },

    //---------------------------------------------------------------------------

    segment: function(ctx, width, lanes, x1, y1, w1, x2, y2, w2, color) {

        var r1 = Render.rumbleWidth(w1, lanes),
            r2 = Render.rumbleWidth(w2, lanes),
            l1 = Render.laneMarkerWidth(w1, lanes),
            l2 = Render.laneMarkerWidth(w2, lanes),
            lanew1, lanew2, lanex1, lanex2, lane;

        ctx.fillStyle = color.grass;
        ctx.fillRect(0, y2, width, y1 - y2);

        Render.polygon(ctx, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, color.rumble);
        Render.polygon(ctx, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, color.rumble);
        Render.polygon(ctx, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, color.road);

        if (color.lane) {
            lanew1 = w1 * 2 / lanes;
            lanew2 = w2 * 2 / lanes;
            lanex1 = x1 - w1 + lanew1;
            lanex2 = x2 - w2 + lanew2;
            for (lane = 1; lane < lanes; lanex1 += lanew1, lanex2 += lanew2, lane++)
                Render.polygon(ctx, lanex1 - l1 / 2, y1, lanex1 + l1 / 2, y1, lanex2 + l2 / 2, y2, lanex2 - l2 / 2, y2, color.lane);
        }

    },

    //---------------------------------------------------------------------------

    background: function(ctx, background, width, height, layer, rotation, offset) {

        rotation = rotation || 0;
        offset = offset || 0;

        var imageW = layer.w / 2;
        var imageH = layer.h;

        var sourceX = layer.x + Math.floor(layer.w * rotation);
        var sourceY = layer.y
        var sourceW = Math.min(imageW, layer.x + layer.w - sourceX);
        var sourceH = imageH;

        var destX = 0;
        var destY = offset;
        var destW = Math.floor(width * (sourceW / imageW));
        var destH = height;

        ctx.drawImage(background, sourceX, sourceY, sourceW, sourceH, destX, destY, destW, destH);

        if (sourceW < imageW) {
            ctx.drawImage(background, layer.x, sourceY, imageW - sourceW, sourceH, destW - 1, destY, width - destW, destH);
        }
    },

    //---------------------------------------------------------------------------

    sprite: function(ctx, width, height, resolution, roadWidth, sprites, sprite, scale, destX, destY, offsetX, offsetY, clipY) {

        //  scale for projection AND relative to roadWidth (for tweakUI)
        var destW = (sprite.w * scale * width / 2) * (SPRITES.SCALE * roadWidth);
        var destH = (sprite.h * scale * width / 2) * (SPRITES.SCALE * roadWidth);

        destX = destX + (destW * (offsetX || 0));
        destY = destY + (destH * (offsetY || 0));

        var clipH = clipY ? Math.max(0, destY + destH - clipY) : 0;
        if (clipH < destH)
            ctx.drawImage(sprites, sprite.x, sprite.y, sprite.w, sprite.h - (sprite.h * clipH / destH), destX, destY, destW, destH - clipH);

    },

    //---------------------------------------------------------------------------

    player: function(ctx, width, height, resolution, roadWidth, sprites, speedPercent, scale, destX, destY, steer, updown) {

        var bounce = (1.5 * Math.random() * speedPercent * resolution) * Util.randomChoice([-1, 1]);
        var sprite;
        if (steer < 0)
            sprite = (updown > 0) ? SPRITES.PLAYER_UPHILL_LEFT : SPRITES.PLAYER_LEFT;
        else if (steer > 0)
            sprite = (updown > 0) ? SPRITES.PLAYER_UPHILL_RIGHT : SPRITES.PLAYER_RIGHT;
        else
            sprite = (updown > 0) ? SPRITES.PLAYER_UPHILL_STRAIGHT : SPRITES.PLAYER_STRAIGHT;

        Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite, scale, destX, destY + bounce, -0.5, -1);
    },

    //---------------------------------------------------------------------------

    rumbleWidth: function(projectedRoadWidth, lanes) {
        return projectedRoadWidth / Math.max(6, 2 * lanes);
    },
    laneMarkerWidth: function(projectedRoadWidth, lanes) {
        return projectedRoadWidth / Math.max(32, 8 * lanes);
    }

}

//=========================================================================
// DOCUMENT LISTENERS
//=========================================================================


//=============================================================================
// RACING GAME CONSTANTS
//=============================================================================

var KEY = {
    UP1: 38,
    DOWN1: 40,
    UP2: 87,
    DOWN2: 83
};

var COLORS = {
    SKY: '#72D7EE',
    TREE: '#005108',
    FOG: '#005108',
    LIGHT: { road: '#6B6B6B', grass: '#10AA10', rumble: '#555555', lane: '#CCCCCC' },
    DARK: { road: '#696969', grass: '#009A00', rumble: '#BBBBBB' },
    START: { road: 'white', grass: 'white', rumble: 'white' },
    FINISH: { road: 'black', grass: 'black', rumble: 'black' }
};

var BACKGROUND = {
    HILLS: { x: 5, y: 5, w: 1280, h: 480 },
    SKY: { x: 5, y: 495, w: 1280, h: 480 },
    TREES: { x: 5, y: 985, w: 1280, h: 480 }
};

var SPRITES = {
    PALM_TREE: { x: 5, y: 5, w: 215, h: 540 },
    BILLBOARD08: { x: 230, y: 5, w: 385, h: 265 },
    TREE1: { x: 625, y: 5, w: 360, h: 360 },
    DEAD_TREE1: { x: 5, y: 555, w: 135, h: 332 },
    BILLBOARD09: { x: 150, y: 555, w: 328, h: 282 },
    BOULDER3: { x: 230, y: 280, w: 320, h: 220 },
    COLUMN: { x: 995, y: 5, w: 200, h: 315 },
    BILLBOARD01: { x: 625, y: 375, w: 300, h: 170 },
    BILLBOARD06: { x: 488, y: 555, w: 298, h: 190 },
    BILLBOARD05: { x: 5, y: 897, w: 298, h: 190 },
    BILLBOARD07: { x: 313, y: 897, w: 298, h: 190 },
    BOULDER2: { x: 621, y: 897, w: 298, h: 140 },
    TREE2: { x: 1205, y: 5, w: 282, h: 295 },
    BILLBOARD04: { x: 1205, y: 310, w: 268, h: 170 },
    DEAD_TREE2: { x: 1205, y: 490, w: 150, h: 260 },
    BOULDER1: { x: 1205, y: 760, w: 168, h: 248 },
    BUSH1: { x: 5, y: 1097, w: 240, h: 155 },
    CACTUS: { x: 929, y: 897, w: 235, h: 118 },
    BUSH2: { x: 255, y: 1097, w: 232, h: 152 },
    BILLBOARD03: { x: 5, y: 1262, w: 230, h: 220 },
    BILLBOARD02: { x: 245, y: 1262, w: 215, h: 220 },
    STUMP: { x: 995, y: 330, w: 195, h: 140 },
    SEMI: { x: 1365, y: 490, w: 122, h: 144 },
    TRUCK: { x: 1365, y: 644, w: 100, h: 78 },
    CAR03: { x: 1383, y: 760, w: 88, h: 55 },
    CAR02: { x: 1383, y: 825, w: 80, h: 59 },
    CAR04: { x: 1383, y: 894, w: 80, h: 57 },
    CAR01: { x: 1205, y: 1018, w: 80, h: 56 },
    PLAYER_UPHILL_LEFT: { x: 1383, y: 961, w: 80, h: 45 },
    PLAYER_UPHILL_STRAIGHT: { x: 1295, y: 1018, w: 80, h: 45 },
    PLAYER_UPHILL_RIGHT: { x: 1385, y: 1018, w: 80, h: 45 },
    PLAYER_LEFT: { x: 995, y: 480, w: 80, h: 41 },
    PLAYER_STRAIGHT: { x: 1085, y: 480, w: 80, h: 41 },
    PLAYER_RIGHT: { x: 995, y: 531, w: 80, h: 41 }
};

SPRITES.SCALE = 0.3 * (1 / SPRITES.PLAYER_STRAIGHT.w) // the reference sprite width should be 1/3rd the (half-)roadWidth

SPRITES.BILLBOARDS = [SPRITES.BILLBOARD01, SPRITES.BILLBOARD02, SPRITES.BILLBOARD03, SPRITES.BILLBOARD04, SPRITES.BILLBOARD05, SPRITES.BILLBOARD06, SPRITES.BILLBOARD07, SPRITES.BILLBOARD08, SPRITES.BILLBOARD09];
SPRITES.PLANTS = [SPRITES.TREE1, SPRITES.TREE2, SPRITES.DEAD_TREE1, SPRITES.DEAD_TREE2, SPRITES.PALM_TREE, SPRITES.BUSH1, SPRITES.BUSH2, SPRITES.CACTUS, SPRITES.STUMP, SPRITES.BOULDER1, SPRITES.BOULDER2, SPRITES.BOULDER3];
SPRITES.CARS = [SPRITES.CAR01, SPRITES.CAR02, SPRITES.CAR03, SPRITES.CAR04, SPRITES.SEMI, SPRITES.TRUCK];
