'use strict';

app.controller('PlayerCtrl', function($scope, Socket) {
    console.log(Socket.emit)
    let analyser;
    let rafID = null;
    let audioContext;
    const MIN_SAMPLES = 0; // will be initialized when AudioContext is created.
    const buflen = 1024;
    const buf = new Float32Array(buflen);
    let isPlaying = true;

    // Socket.on('raceStart', function() {
    	isPlaying = true;
        toggleLiveInput();
    // })
    Socket.emit("joined", {})
    // Socket.on("velocity", function(data){
    //     console.log("velocity from server", data)
    // })

    Socket.on('raceEnd', function() {
    	isPlaying = false;
    })
    //ALL CREDIT REGARDING THE LOGIC SURROUNDING PITCH SHALL GO TO https://github.com/cwilso/PitchDetect

    if (window.DeviceOrientationEvent) {
      const deviceOrientation = [0, 0, 0, 0, 0];
      // Listen for the deviceorientation event and handle the raw data
      window.addEventListener('deviceorientation', function(eventData) {
        // gamma is the left-to-right tilt in degrees, where right is positive

        let tiltLR = eventData.gamma;
        if (Math.abs(tiltLR - deviceOrientation[deviceOrientation.length-1]) > 0.05) {
            deviceOrientation.shift();
            deviceOrientation.push(tiltLR);
            let averageOrientation = deviceOrientation.reduce(function(prev, curr){
                return prev + curr
            }, 0)/ deviceOrientation.length
            Socket.emit('xOrientationChange', {deviceXOrientation: averageOrientation})
        }



        // beta is the front-to-back tilt in degrees, where front is positive
        let tiltFB = eventData.beta;

        // alpha is the compass direction the device is facing in degrees
        let dir = eventData.alpha

        // call our orientation event handler
      }, false);
    } else {
        alert('not supported')
    }



    function getUserMedia(dictionary, callback) {
        try {
            navigator.getUserMedia =
                navigator.getUserMedia ||
                navigator.webkitGetUserMedia ||
                navigator.mozGetUserMedia;
            navigator.getUserMedia(dictionary, callback, function(e) {
                alert(e);
            });
        } catch (e) {
            alert('getUserMedia threw exception :' + e);
        }
    }

    function toggleLiveInput() {
        console.log('inside toggle');

        getUserMedia({
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream);
    }

    function gotStream(stream) {
        console.log('inside gotstream');
        console.log(stream);
        audioContext = new AudioContext();
        // Create an AudioNode from the stream.
        const mediaStreamSource = audioContext.createMediaStreamSource(stream);

        // Connect it to the destination.
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        console.log('this is the analyser', analyser)
        mediaStreamSource.connect(analyser);
        updatePitch();
    }

    function autoCorrelate(buf, sampleRate) {
        var SIZE = buf.length;
        var MAX_SAMPLES = Math.floor(SIZE / 2);
        var best_offset = -1;
        var best_correlation = 0;
        var rms = 0;
        var foundGoodCorrelation = false;
        var correlations = new Array(MAX_SAMPLES);

        for (var i = 0; i < SIZE; i++) {
            var val = buf[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) // not enough signal
            return -1;

        var lastCorrelation = 1;
        for (var offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
            var correlation = 0;

            for (var i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs((buf[i]) - (buf[i + offset]));
            }
            correlation = 1 - (correlation / MAX_SAMPLES);
            correlations[offset] = correlation; // store it, for the tweaking we need to do below.
            if ((correlation > 0.9) && (correlation > lastCorrelation)) {
                foundGoodCorrelation = true;
                if (correlation > best_correlation) {
                    best_correlation = correlation;
                    best_offset = offset;
                }
            } else if (foundGoodCorrelation) {
                // short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
                // Now we need to tweak the offset - by interpolating between the values to the left and right of the
                // best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
                // we need to do a curve fit on correlations[] around best_offset in order to better determine precise
                // (anti-aliased) offset.

                // we know best_offset >=1,
                // since foundGoodCorrelation cannot go to true until the second pass (offset=1), and
                // we can't drop into this clause until the following pass (else if).
                var shift = (correlations[best_offset + 1] - correlations[best_offset - 1]) / correlations[best_offset];
                return sampleRate / (best_offset + (8 * shift));
            }
            lastCorrelation = correlation;
        }
        if (best_correlation > 0.01) {
            // console.log("f = " + sampleRate/best_offset + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
            return sampleRate / best_offset;
        }
        return -1;
        //	var best_frequency = sampleRate/best_offset;
    }

    const lastFivePitches = [0, 0, 0, 0, 0];
    let i =0;
    function updatePitch(time) {
        // console.log(isPlaying)
    	if(!isPlaying){
    		return false;
    	}
        analyser.getFloatTimeDomainData(buf);
        let ac = autoCorrelate(buf, audioContext.sampleRate);

        // console.log('ac', ac)
        let velocity;
        if (ac === -1) {
            //this is equivalent to slamming on the brake -- velocity goes to 0
            velocity = 0;
            Socket.emit('velocity', {velocity: velocity});
            // console.log("emiltting velocity")

        } else {
            if (Math.abs(ac - lastFivePitches[lastFivePitches.length-1]) > 50){
                lastFivePitches.shift();
                lastFivePitches.push(ac);
                let averagePitch = lastFivePitches.reduce(function(prev, curr) {
                    return prev + curr
                }, 0) / lastFivePitches.length; //should be 5, unless we change how many things to track
                // console.log('ap',averagePitch)
                if(averagePitch > 350){
                	velocity = 350/averagePitch;
                } else if (averagePitch > 600) {
                	velocity = 0;
                }else {
                	velocity = averagePitch/350;
                }
                $scope.prettyVelocity = Math.round(velocity * 230)
                $scope.$apply();
                Socket.emit('velocity', {velocity: velocity});

            }
        }



        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = window.webkitRequestAnimationFrame;
        }
        rafID = window.requestAnimationFrame(updatePitch);
    }

});
