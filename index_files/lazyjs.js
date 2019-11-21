var Carbon;
(function (Carbon) {
    var LazyLoader = (function () {
        function LazyLoader(options) {
            if (options === void 0) { options = {}; }
            var _this = this;
            if (!('IntersectionObserver' in window)) {
                throw new Error('Missing IntersectionObserver API');
            }
            this.observer = new IntersectionObserver(function (entries) {
                for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                    var entry = entries_1[_i];
                    if (entry.intersectionRatio > 0) {
                        _this.load(entry.target);
                        var index = _this.indexOf(entry.target);
                        if (_this.elements.length > index + 2) {
                            _this.load(_this.elements[index + 1]);
                        }
                        if (_this.elements.length > index + 3) {
                            _this.load(_this.elements[index + 2]);
                        }
                    }
                }
            }, {
                threshold: 0.01,
                rootMargin: options.margin || '200px 0px'
            });
        }
        LazyLoader.prototype.indexOf = function (element) {
            for (var i = 0; i < this.elements.length; i++) {
                if (this.elements[i] === element) {
                    return i;
                }
            }
            return -1;
        };
        LazyLoader.prototype.setup = function () {
            this.elements = Array.from(document.querySelectorAll('img.lazy, video.lazy'));
            for (var i = 0; i < this.elements.length; i++) {
                this.observer.observe(this.elements[i]);
            }
        };
        LazyLoader.prototype.load = function (el) {
            var _a = el.dataset, src = _a.src, srcset = _a.srcset;
            if (!src) {
                throw new Error('[Lazy] Missing data-src');
            }
            if (!el.classList.contains('lazy')) {
                return;
            }
            if (el.tagName == 'IMG') {
                var img = void 0;
                if (src.indexOf('.gif') > -1) {
                    img = new Image();
                }
                else {
                    img = el;
                }
                el.classList.add('loading');
                img.onload = function () {
                    el.classList.remove('loading');
                    el.classList.add('loaded');
                };
                img.src = src;
            }
            if (srcset && el.tagName == 'IMG') {
                el.srcset = srcset;
            }
            el.src = src;
            if (el.tagName == 'video' && el.hasAttribute('autoplay')) {
                el.play();
            }
            el.classList.remove('lazy');
        };
        return LazyLoader;
    }());
    Carbon.LazyLoader = LazyLoader;
})(Carbon || (Carbon = {}));
