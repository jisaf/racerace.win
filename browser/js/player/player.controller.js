'use strict';

app.controller('PlayerCtrl', function($scope) {
    let analyser;
    let rafID = null;
    let audioContext;
    const MIN_SAMPLES = 0; // will be initialized when AudioContext is created.
    const buflen = 1024;
    const buf = new Float32Array(buflen);
    let isPlaying = false;

    // socket.on('raceStart', function() {
    // 	isPlaying = true;
        toggleLiveInput();
    // })

    // socket.on('raceEnd', function() {
    // 	isPlaying = false;
    // })


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
    	// if(!isPlaying){
    	// 	return false;
    	// }
        analyser.getFloatTimeDomainData(buf);
        const ac = autoCorrelate(buf, audioContext.sampleRate);

        console.log('ac', ac)
        if (ac == -1) {
            //this is equivalent to slamming on the brake -- velocity goes to 0
        	// socket.emit('velocity', {velocity: 0})
        } else {
            lastFivePitches.shift();
            lastFivePitches.push(ac);
            let averagePitch = lastFivePitches.reduce(function(prev, curr) {
                return prev + curr
            }, 0) / lastFivePitches.length; //should be 5, unless we change how many things to track
            let velocity;
            if(averagePitch > 350){
            	velocity = 350/averagePitch;
            } else if (averagePitch > 600) {
            	velocity = 0;
            }else {
            	velocity = averagePitch/350;
            }
            console.log(velocity)
            // socket.emit('velocity', {velocity: velocity});
        }

        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = window.webkitRequestAnimationFrame;
        }
        debugger;
        i++;
        // console.log(i)
        if(i===100){
        	return;
        }
        rafID = window.requestAnimationFrame(updatePitch);
    }

});
