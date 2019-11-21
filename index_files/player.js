"use strict";
if (window.shaka) {
    shaka.polyfill.installAll();
}
var Carbon;
(function (Carbon) {
    var UserSelect = {
        blockSelect(e) {
            e.preventDefault();
            e.stopPropagation();
        },
        block() {
            document.body.focus();
            document.addEventListener('selectstart', UserSelect.blockSelect, true);
        },
        unblock() {
            document.removeEventListener('selectstart', UserSelect.blockSelect, true);
        }
    };
    var Util = {
        getRelativePosition(x, relativeElement) {
            let leftOffset = relativeElement.getBoundingClientRect().left;
            return Math.max(0, Math.min(1, (x - leftOffset) / relativeElement.offsetWidth));
        },
        padLeft(num, width, char) {
            return Array(width - String(num).length + 1).join(char || '0') + num;
        }
    };
    class MediaSource {
        constructor(attributes) {
            this.src = attributes.src;
            this.type = attributes.type;
        }
        toElement() {
            let el = document.createElement('source');
            el.src = this.src;
            el.type = this.type;
            return el;
        }
    }
    Carbon.MediaPlayerFactory = {
        pauseAll() {
            for (var el of Array.from(document.querySelectorAll('.playing'))) {
                MediaPlayer.get(el).pause();
            }
        }
    };
    class MediaPlayer {
        constructor(element, options) {
            this.sources = [];
            this.status = 0;
            this.bufferedTime = 0;
            this.index = 0;
            this.ready = new Deferred();
            this.playRequested = false;
            if (!element)
                throw new Error('[MediaPlayer] not found');
            this.element = element;
            this.width = element.clientWidth;
            this.height = element.clientHeight;
            this.head = this.element.querySelector('video,audio');
            this.head.controls = false;
            this.type = this.head.tagName.toLowerCase();
            if (options) {
                if (options.sources) {
                    for (var source of options.sources) {
                        this.head.appendChild(new MediaSource(source).toElement());
                    }
                }
                if (options.poster) {
                    this.setPoster(options.poster);
                }
            }
            let isAndroid = navigator.userAgent.indexOf("Android") > -1;
            let isAudio = this.head.tagName == 'AUDIO';
            for (var el of Array.from(this.head.querySelectorAll('source'))) {
                let isPlaylist = (el.type === 'application/dash+xml' || el.type === 'application/x-mpegURL');
                if (!this.shakaPlayer && isPlaylist && (!this.head.canPlayType(el.type) || (isAndroid && isAudio))) {
                    let controller = new shaka.Player(this.head);
                    let bandwidth = 2500000;
                    if (navigator.connection && navigator.connection.downlink) {
                        bandwidth = navigator.connection.downlink * 1000000;
                    }
                    if (bandwidth > 500000) {
                        controller.configure({
                            abr: {
                                defaultBandwidthEstimate: bandwidth
                            }
                        });
                    }
                    controller.addEventListener('error', (err) => {
                        console.error('load error', err);
                    });
                    controller.load(el.src).then(r => {
                        if (this.playRequested) {
                            this.play();
                        }
                    });
                    this.head.shakaPlayer = controller;
                    this.shakaPlayer = controller;
                }
                this.sources.push(new MediaSource(el));
            }
            this.element.classList.add('supportsFullscreen');
            document.addEventListener('fullscreenchange', this.onFullscreenChange.bind(this), false);
            this.controls = new MediaPlayerControls(this);
            if (options && options.duration) {
                this.controls.setDuration(options.duration);
            }
            this.head.addEventListener('durationchange', this.onLoad.bind(this));
            this.head.addEventListener('ended', this.onEnded.bind(this));
            this.head.addEventListener('timeupdate', this.onTimeUpdate.bind(this));
            this.head.addEventListener('progress', this.onProgress.bind(this));
            this.head.addEventListener('seeking', this.onSeeking.bind(this));
            this.head.addEventListener('seeked', this.onSeeked.bind(this));
            this.head.addEventListener('waiting', this.onWaiting.bind(this));
            this.head.addEventListener('error', this.onError.bind(this));
            if (this.autoplay)
                this.play();
            MediaPlayer.instances.set(this.element, this);
        }
        static get(el, options) {
            if (!el)
                throw new Error('[MediaPlayer] element is undefined');
            return MediaPlayer.instances.get(el) || new MediaPlayer(el, options);
        }
        on(type, callback) {
            this.element.addEventListener(type, callback, false);
        }
        setSize(width, height) {
            this.width = width;
            this.height = height;
            this.element.style.width = width + 'px';
            this.element.style.height = height + 'px';
        }
        setPoster(poster) {
            let posterEl = this.element.querySelector('.poster');
            if (posterEl) {
                posterEl.style.backgroundImage = `url('${poster.src || poster.url}')`;
            }
        }
        get autoplay() {
            return this.head.hasAttribute('autoplay');
        }
        get played() {
            return this.element.matches('.played');
        }
        get playing() {
            return this.element.matches('.playing');
        }
        get paused() {
            return this.head.paused;
        }
        get ended() {
            return this.head.ended;
        }
        get seeking() {
            return this.element.matches('.seeking');
        }
        get duration() {
            return this.head.duration;
        }
        get volume() {
            return this.head.volume;
        }
        set volume(value) {
            this.head.volume = value;
        }
        get currentTime() {
            return this.head.currentTime;
        }
        get muted() {
            return this.head.muted;
        }
        reset() {
            this.bufferedTime = 0;
            this.element.classList.remove('played', 'playing', 'paused');
            this.element.classList.add('waiting');
            this.controls.reset();
        }
        onPlay() {
            this.element.classList.remove('paused', 'ended');
            this.element.classList.add('playing', 'played');
            if (navigator.userAgent.indexOf('iPad') > -1) {
                this.head.webkitRequestFullScreen();
            }
            trigger(this.element, 'player:play', {
                instance: this
            });
        }
        onPause() {
            if (this.seeking)
                return;
            this.element.classList.remove('playing');
            this.element.classList.add('paused');
            trigger(this.element, 'player:pause', {
                instance: this
            });
        }
        onEnded() {
            this.element.classList.remove('playing');
            this.element.classList.add('ended');
            trigger(this.element, 'player:ended', {
                instance: this
            });
        }
        onLoad() {
            this.element.classList.remove('loading');
            if (this.status != 1) {
                this.ready.resolve();
                trigger(this.element, 'player:loaded', {
                    instance: this,
                    duration: this.duration
                });
            }
            this.status = 1;
        }
        onTimeUpdate(e) {
            if (this.status != 1) {
                this.onLoad();
            }
            this.element.classList.remove('waiting');
            trigger(this.element, 'player:timeupdate', {
                instance: this,
                duration: this.duration,
                currentTime: this.head.currentTime,
                position: this.head.currentTime / this.head.duration
            });
        }
        onBufferedTimeChange(bufferedTime) {
            this.bufferedTime = bufferedTime;
            trigger(this.element, 'player:bufferupdate', {
                instance: this,
                bufferedTime: bufferedTime
            });
        }
        mute() {
            this.head.muted = true;
            let volumeEl = this.element.querySelector('.volume');
            volumeEl && volumeEl.classList.add('muted');
            trigger(this.element, 'player:muted', {
                instance: this
            });
        }
        unmute() {
            this.head.muted = false;
            this.element.classList.remove('muted');
            let volumeEl = this.element.querySelector('.volume');
            volumeEl && volumeEl.classList.remove('muted');
        }
        onError(error) {
            console.log('media error', error);
        }
        onSeeking() {
            this.element.classList.add('waiting');
            trigger(this.element, 'player:seeking', {
                instance: this
            });
        }
        onSeeked() {
            this.element.classList.remove('seeking', 'waiting');
            trigger(this.element, 'player:seeked', {
                instance: this
            });
        }
        onWaiting() {
            trigger(this.element, 'player:waiting', {
                instance: this
            });
        }
        get isFullscreen() {
            return document.fullscreenElement !== null;
        }
        enterFullscreen() {
            this.element.requestFullscreen();
            document.body.classList.add('playerIsFullscreen');
            this.element.classList.add('fullscreen');
        }
        exitFullscreen() {
            document.body.classList.remove('playerIsFullscreen');
            this.element.classList.remove('fullscreen');
            this.isFullscreen && document.exitFullscreen();
        }
        onFullscreenChange(e) {
            this.element && this.element.classList.toggle('fullscreen', this.isFullscreen);
        }
        play() {
            this.playRequested = true;
            Carbon.MediaPlayerFactory.pauseAll();
            this.head.play();
            this.onPlay();
            if (this.status != 1) {
                this.element.classList.add('loading');
            }
            return this.ready.promise;
        }
        pause() {
            this.playRequested = false;
            this.head.pause();
            this.onPause();
        }
        seek(time) {
            this.element.classList.add('seeking');
            if (this.status) {
                this.head.currentTime = time;
            }
            trigger(this.element, 'player:seek', {
                instance: this,
                seekTime: time
            });
        }
        setSources(sources) {
            this.sources = sources;
            this.head.innerHTML = '';
            for (var source of sources) {
                this.element.appendChild(new MediaSource(source).toElement());
            }
            this.load();
        }
        load() {
            if (!this.paused)
                this.pause();
            this.reset();
            this.head.load();
        }
        onProgress(e) {
            let buffered = this.head.buffered;
            if (!(buffered && buffered.length >= 1))
                return;
            let bufferedTime = buffered.end(0);
            this.onBufferedTimeChange(bufferedTime);
        }
    }
    MediaPlayer.instances = new WeakMap();
    Carbon.MediaPlayer = MediaPlayer;
    class MediaPlayerControls {
        constructor(player) {
            this.hidden = false;
            this.player = player;
            this.element = this.player.element.querySelector('carbon-controls');
            let scrubberEl = this.element.querySelector('carbon-scrubber');
            this.scrubber = new Scrubber(scrubberEl, this);
            let muteToggleEl = this.element.querySelector('.muteToggle');
            let fullscreenToggleEl = this.element.querySelector('.fullscreenToggle');
            if (muteToggleEl)
                muteToggleEl.addEventListener('click', this.toggleMute.bind(this), true);
            if (fullscreenToggleEl)
                fullscreenToggleEl.addEventListener('click', this.toggleFullscreen.bind(this), true);
            this.bufferedBar = new Bar(this.element.querySelector('.bufferedBar'));
            this.playedBar = new Bar(this.element.querySelector('.playedBar'));
            this.currentTimeEl = this.element.querySelector('time.current');
            this.totalTimeEl = this.element.querySelector('time.total');
            this.player.on('player:seek', this.onTimeUpdate.bind(this));
            this.player.on('player:timeupdate', this.onTimeUpdate.bind(this));
            this.player.on('player:bufferupdate', this.onBufferUpdate.bind(this));
            this.player.on('mousemove', this.mouseMove.bind(this));
            this.player.on('mouseenter', this.mouseMove.bind(this));
            this.player.on('mouseleave', this.mouseOut.bind(this));
            if (!this.player.element.matches('.audio')) {
                this.player.element.addEventListener('click', this.togglePlay.bind(this));
            }
            let isTouch = ('ontouchstart' in window) || (navigator.msMaxTouchPoints > 0);
            isTouch && this.element.classList.add('touchable');
            this.element.querySelector('.playToggle').addEventListener('click', this.togglePlay.bind(this));
        }
        onBufferUpdate(e) {
            let bufferedValue = e.detail.bufferedTime / this.player.duration;
            this.bufferedBar.setValue(bufferedValue);
        }
        setDuration(duration) {
            let minutes = Math.floor(duration / 60);
            let seconds = Math.floor(duration % 60);
            this.totalTimeEl.innerText = Util.padLeft(minutes, 1, '0') + ":" + Util.padLeft(seconds, 2, '0');
        }
        onTimeUpdate(e) {
            let time = this.player.currentTime;
            let playedValue = time / this.player.duration;
            let minutes = Math.floor(time / 60);
            let seconds = Math.floor(time % 60);
            this.playedBar.setValue(playedValue);
            this.currentTimeEl.innerText = Util.padLeft(minutes, 1, '0') + ":" + Util.padLeft(seconds, 2, '0');
            let left = this.playedBar.width();
            var currentTimeWidth = outerWidth(this.currentTimeEl);
            if (left > currentTimeWidth) {
                this.currentTimeEl.style.left = (left - currentTimeWidth) + 'px';
            }
        }
        toggleMute(e) {
            e.stopPropagation();
            this.player.element.classList.toggle('muted', this.player.muted);
            if (this.player.muted) {
                this.player.unmute();
            }
            else {
                this.player.mute();
            }
        }
        togglePlay(e) {
            if (this.player.paused) {
                this.player.play();
            }
            else {
                this.player.pause();
            }
            e.stopPropagation();
            e.preventDefault();
        }
        toggleFullscreen(e) {
            if (this.player.isFullscreen) {
                this.player.exitFullscreen();
            }
            else {
                this.player.enterFullscreen();
            }
            e.stopPropagation();
        }
        reset() {
            this.playedBar.setValue(0);
            this.bufferedBar.setValue(0);
        }
        hoverIdle(e) {
            this.player.element.classList.add('hoverIdle');
            this.one = true;
        }
        mouseOut(e) {
            this.player.element.classList.remove('hovering', 'hoverIdle');
        }
        mouseMove(e) {
            if (this.one) {
                this.one = false;
                return;
            }
            this.player.element.classList.remove('hoverIdle');
            this.player.element.classList.add('hovering');
            if (this.mouseMoveTimeout) {
                clearInterval(this.mouseMoveTimeout);
            }
            this.mouseMoveTimeout = setTimeout(this.hoverIdle.bind(this), 3000);
        }
    }
    Carbon.MediaPlayerControls = MediaPlayerControls;
    class Scrubber {
        constructor(element, controls) {
            this.dragging = false;
            this.wasPlaying = false;
            this.isTouch = ('ontouchstart' in window) || (navigator.msMaxTouchPoints > 0);
            this.listeners = [];
            this.element = element;
            this.controls = controls;
            this.player = this.controls.player;
            this.trackEl = this.element.querySelector('.track');
            if (!this.trackEl)
                this.trackEl = this.element;
            if (this.isTouch) {
                this.trackEl.addEventListener('touchstart', this.startScrub.bind(this), false);
            }
            else {
                this.trackEl.addEventListener('mousedown', this.startScrub.bind(this), false);
                this.trackEl.addEventListener('mouseover', this.onMouseOver.bind(this), false);
                this.trackEl.addEventListener('mouseout', this.onMouseOut.bind(this), false);
            }
            this.element.addEventListener('click', e => {
                e.stopPropagation();
                e.preventDefault();
            }, true);
        }
        onMouseOver(e) {
            this.player.element.classList.add('hoveringTrack');
        }
        onMouseOut(e) {
            this.player.element.classList.remove('hoveringTrack');
        }
        startScrub(e) {
            if (!this.player.played) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            UserSelect.block();
            this.wasPlaying = !this.player.paused;
            this.dragging = true;
            this.scrubTo(e);
            if (this.wasPlaying)
                this.player.pause();
            if (this.wasPlaying) {
                this.player.element.classList.remove('paused');
                this.player.element.classList.add('playing');
            }
            if (this.isTouch) {
                this.listeners.push(new EventHandler(this.trackEl, 'touchend', this.stopScrub.bind(this)), new EventHandler(this.trackEl, 'touchmove', this.scrubTo.bind(this)));
            }
            else {
                this.listeners.push(new EventHandler(document, 'mousemove', this.scrubTo.bind(this)), new EventHandler(document, 'mouseup', this.stopScrub.bind(this)));
            }
        }
        stopScrub(e) {
            UserSelect.unblock();
            this.dragging = false;
            this.scrubTo(e);
            if (this.wasPlaying)
                this.player.play();
            this.player.element.classList.remove('scrubbing');
            while (this.listeners.length > 0) {
                this.listeners.pop().stop();
            }
        }
        scrubTo(e) {
            let x = e.pageX;
            let position = Util.getRelativePosition(x, this.element);
            if (e.type == 'mousemove') {
                this.player.element.classList.add('scrubbing');
            }
            this.setPosition(position);
        }
        setPosition(position) {
            this.controls.playedBar.setValue(position);
            let seekTime = this.player.duration * position;
            this.player.seek(seekTime);
        }
    }
    class Bar {
        constructor(element) {
            this.element = element;
        }
        setValue(value) {
            if (!this.element)
                return;
            if (value == 1) {
                this.element.classList.add('end');
            }
            else {
                this.element.classList.remove('end');
            }
            this.element.style.width = (value * 100) + '%';
        }
        width() {
            if (!this.element)
                return 0;
            return this.element.clientWidth;
        }
    }
    class Waveform {
        constructor(element, options) {
            this.fetching = false;
            this.element = element;
            this.options = options;
            this.samples = this.options.data;
            if (this.element.dataset['samples']) {
                this.samples = JSON.parse(element.dataset['samples']);
            }
            if (!this.samples) {
                this._fetchData();
            }
            else {
                this.render();
            }
            let playerEl = this.element.closest('carbon-player');
            playerEl.addEventListener('player:timeupdate', this.fill.bind(this));
            window.addEventListener('resize', this.render.bind(this), false);
        }
        fill(e) {
            let barCount = this.element.childNodes.length;
            let barsToFill = Math.ceil(barCount * e.detail.position);
            for (var i = 0; i < barCount; i++) {
                let el = this.element.childNodes[i];
                if (i < barsToFill) {
                    el.classList.add('fill');
                }
                else {
                    el.classList.remove('fill');
                }
            }
        }
        _fetchData() {
            let sampleSrc = this.element.dataset['sampleSrc'];
            if (!sampleSrc)
                throw new Error('[Waveform] missing sample-src found');
            fetch(sampleSrc, {
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            }).then(response => response.json())
                .then(json => {
                this.samples = json.samples;
                this.render();
            });
        }
        render() {
            if (!this.samples)
                return;
            if (this.width == this.element.offsetWidth)
                return;
            this.width = this.element.offsetWidth;
            this.height = this.element.offsetHeight;
            if (this.options.onRender) {
                this.options.onRender.call(this);
            }
            let left = 0;
            this.element.innerHTML = '';
            let barCount = 0;
            for (var i = 0; i < 1000; i++) {
                left += this.options.barWidth;
                if (left > this.width)
                    break;
                barCount++;
                if (left == this.width)
                    break;
                left += this.options.gap;
            }
            left = 0;
            let pointsPerBar = this.samples.length / barCount;
            var barEl, sample, start, sum, avg, samples;
            for (var i = 0; i < barCount; i++) {
                if (pointsPerBar <= 1) {
                    start = Math.max(Math.floor(i * pointsPerBar), 1);
                    sample = this.samples[start];
                }
                else {
                    start = Math.max(Math.floor(i * pointsPerBar), 1);
                    samples = this.samples.slice(start, start + Math.floor(pointsPerBar));
                    sum = samples.reduce((a, b) => a + b);
                    avg = sum / samples.length;
                    sample = avg;
                }
                barEl = document.createElement('span');
                barEl.className = 'bar';
                barEl.style.width = this.options.barWidth + 'px';
                barEl.style.height = (this.height * sample) + 'px';
                barEl.style.left = left + 'px';
                this.element.appendChild(barEl);
                left += this.options.barWidth + this.options.gap;
            }
        }
    }
    Carbon.Waveform = Waveform;
    function outerWidth(el) {
        let css = getComputedStyle(el);
        return parseInt(css.marginLeft, 10) + parseInt(css.marginRight, 10) + parseInt(css.width, 10);
    }
    ;
    function trigger(element, name, detail) {
        return element && element.dispatchEvent(new CustomEvent(name, {
            bubbles: true,
            detail: detail
        }));
    }
    Carbon.trigger = trigger;
    class Deferred {
        constructor() {
            this.promise = new Promise((resolve, reject) => {
                this._resolve = resolve;
                this._reject = reject;
            });
        }
        resolve(value) {
            this._resolve(value);
        }
        reject(value) {
            this._reject(value);
        }
    }
    class EventHandler {
        constructor(element, type, handler, useCapture = false) {
            this.element = element;
            this.type = type;
            this.handler = handler;
            this.useCapture = useCapture;
            this.element.addEventListener(type, handler, useCapture);
        }
        stop() {
            this.element.removeEventListener(this.type, this.handler, this.useCapture);
        }
    }
})(Carbon || (Carbon = {}));
Carbon.controllers.set('waveform', {
    setup(e) {
        if (e.target.matches('.setup')) {
            throw new Error('already setup');
        }
        e.target.classList.add('setup');
        let options = {
            barWidth: 3,
            gap: 2,
            onRender() {
                this.options.barWidth = this.width < 600 ? 2 : 3;
                this.options.gap = this.width < 600 ? 1 : 2;
            }
        };
        new Carbon.Waveform(e.target, options);
    }
});
Carbon.controllers.set('player', {
    setup(e) {
        Carbon.MediaPlayer.get(e.target.closest('carbon-player'));
    },
    play(e) {
        let playerEl = e.target.closest('carbon-player');
        let mediaEl = playerEl.querySelector('video,audio');
        mediaEl.autoplay = true;
        Carbon.MediaPlayer.get(playerEl).play();
    },
    togglePlay(e) {
        let target = e.target;
        let player = Carbon.MediaPlayer.get(target.closest('carbon-player'));
        if (player.paused)
            player.play();
        else
            player.pause();
    },
    pause(e) {
        Carbon.MediaPlayer.get(e.target.closest('carbon-player')).pause();
    }
});
