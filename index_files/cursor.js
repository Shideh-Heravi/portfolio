"use strict";
var Carbon;
(function (Carbon) {
    let icons = {
        'zoom-in': `<svg width="60" height="60" viewBox="0 0 60 60" fill="none">
    <circle cx="30" cy="30" r="29" stroke="#fff" stroke-width="2"/>
    <rect class="l1" x="29" y="20" width="2" height="20" rx="1" fill="#fff"/>
    <rect class="l2" x="40" y="29" width="2" height="20" rx="1" transform="rotate(90 40 29)" fill="#fff"/>
  </svg>`,
        'left-arrow': `<svg width="41" height="78" viewBox="0 0 21 39" fill="none">
    <path d="M18.3595 37.1641L2.62815 21.3972C2.42907 21.1988 2.27111 20.9631 2.16333 20.7035C2.05555 20.4439 2.00006 20.1656 2.00006 19.8846C2.00006 19.6035 2.05555 19.3252 2.16333 19.0657C2.27111 18.8061 2.42907 18.5703 2.62815 18.3719L19.0001 1.99998" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
        'right-arrow': `<svg width="41" height="78" viewBox="0 0 21 39" fill="none">
    <path d="M2.64064 2L18.372 17.7669C18.5711 17.9653 18.729 18.2011 18.8368 18.4606C18.9446 18.7202 19.0001 18.9985 19.0001 19.2795C19.0001 19.5606 18.9446 19.8389 18.8368 20.0985C18.729 20.358 18.5711 20.5938 18.372 20.7922L2 37.1641" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
    };
    class Cursor {
        constructor(element, options) {
            this.type = 'zoom-in';
            this.properties = {
                scale: 1,
                rotate: 0,
                rotateY: 0
            };
            this.defaultScale = 0.7;
            this.reactive = new Carbon.Reactive();
            this.icon = 'zoom-in';
            this.mode = 'dynamic';
            this.hidden = false;
            this.element = element;
            this.type = 'zoom-in';
            if (options && options.scale) {
                this.defaultScale = options.scale;
            }
            this.properties.scale = this.defaultScale;
            this.animate(0);
        }
        static create(options = {}) {
            let el = document.createElement('div');
            let type = options.type || 'zoom-in';
            let style = `position:fixed;display:none;top:0;left:0;pointer-events:none;z-index:10000;`;
            if (options.blendMode) {
                style += 'mix-blend-mode:' + options.blendMode + ';';
            }
            el.innerHTML = `<div class="cursor" style="${style}">` + icons[type] + `</div>`;
            let parsedEl = el.firstElementChild;
            document.body.appendChild(parsedEl);
            return new Cursor(parsedEl, options);
        }
        async scale(value, options = {}) {
            if (this.properties.scale == value) {
                return true;
            }
            this.properties.scale = value;
            await this.animate();
        }
        async show() {
            this.hidden = false;
            this.element.style.opacity = '1';
            this.element.style.display = null;
        }
        async hide() {
            this.element.style.display = 'none';
            this.hidden = true;
        }
        setType(value) {
            switch (value) {
                case 'zoom-in':
                    this.toZoomIn();
                    break;
                case 'zoom-out':
                    this.toZoomOut();
                    break;
                case 'close':
                    this.toClose();
                    break;
                case 'left-arrow':
                    this.toLeftArrow();
                    break;
                case 'right-arrow':
                    this.toRightArrow();
                    break;
            }
        }
        toZoomIn() {
            if (this.type == 'zoom-in')
                return Promise.resolve();
            this.setIcon('zoom-in');
            this.l1El.style.transition = 'height 100ms ease-out, opacity 100ms ease-out';
            this.l1El.style.height = '20px';
            this.l1El.style.opacity = '1';
            this.type = 'zoom-in';
            return this.rotate(0);
        }
        toZoomOut() {
            if (this.type == 'zoom-out') {
                return true;
            }
            this.setIcon('zoom-in');
            this.l1El.style.transition = 'height 100ms ease-out, opacity 100ms ease-out';
            this.l1El.style.height = '0px';
            this.l1El.style.opacity = '0';
            this.type = 'zoom-out';
            return this.rotate(0);
        }
        async toClose() {
            if (this.type == 'close') {
                return true;
            }
            this.setIcon('zoom-in');
            this.type = 'close';
            this.l1El.style.transition = 'height 100ms ease-out, opacity 100ms ease-out';
            this.l1El.style.height = '20px';
            this.l1El.style.opacity = '1';
            await this.rotate(45);
        }
        async toRightArrow() {
            if (this.type == 'right-arrow') {
                return true;
            }
            this.type = 'right-arrow';
            var flip = this.icon == 'left-arrow';
            if (!flip) {
                this.setIcon('right-arrow');
            }
            this.properties.rotate = 0;
            this.properties.rotateY = flip ? -180 : 0;
            this.animate(200);
        }
        async toLeftArrow() {
            if (this.type == 'left-arrow')
                return;
            this.type = 'left-arrow';
            var flip = this.icon == 'right-arrow';
            if (!flip) {
                this.setIcon('left-arrow');
            }
            this.properties.rotate = 0;
            this.properties.rotateY = flip ? -180 : 0;
            await this.animate(200);
        }
        onMouseMove(e) {
            if (!this.lastEvent || this.lastEvent && this.lastEvent.srcElement !== e.srcElement) {
                if (this.mode == 'dynamic') {
                    let el;
                    if (e.srcElement && (el = e.srcElement.closest('[data-cursor]'))) {
                        el.style.cursor = 'none';
                        this.setType(el.dataset['cursor']);
                        this.show();
                    }
                    else {
                        this.hide();
                    }
                }
                this.reactive.trigger('hover', { target: e.srcElement });
            }
            this.reactive.trigger('move', {
                target: e.srcElement,
                clientX: e.clientX,
                clientY: e.clientY
            });
            this.lastEvent = e;
            if (this.hidden)
                return;
            this.element.style.top = e.clientY + 'px';
            this.element.style.left = e.clientX + 'px';
        }
        on(name, e) {
            return this.reactive.on(name, e);
        }
        get position() {
            return {
                x: this.lastEvent.clientX,
                y: this.lastEvent.clientY
            };
        }
        stop() {
            this.mouseMoveListener && document.removeEventListener('mousemove', this.mouseMoveListener, false);
            this.mouseMoveListener = null;
        }
        start() {
            if (this.mouseMoveListener)
                return;
            this.mouseMoveListener = this.onMouseMove.bind(this);
            document.addEventListener('mousemove', this.mouseMoveListener, false);
            document.addEventListener('mousedown', this.onMouseDown.bind(this), false);
            document.addEventListener('mouseup', this.onMouseUp.bind(this), false);
        }
        onMouseDown(e) {
            this.originalScale = this.properties.scale;
            this.properties.scale *= 1.2;
            this.animate(100);
        }
        onMouseUp(e) {
            this.properties.scale = this.originalScale;
            this.animate(100);
        }
        get svgEl() {
            return this.element.querySelector('svg');
        }
        get l1El() {
            return this.element.querySelector('.l1');
        }
        get l2El() {
            return this.element.querySelector('.l2');
        }
        setIcon(name) {
            if (this.icon != name) {
                this.icon = name;
                this.svgEl.outerHTML = icons[name];
            }
        }
        async rotateY(value) {
            if (this.properties.rotateY === value) {
                return true;
            }
            this.properties.rotateY = value;
            await this.animate();
        }
        async rotate(value) {
            if (this.properties.rotate === value) {
                return true;
            }
            this.properties.rotate = value;
            await this.animate();
        }
        animate(duration = 200) {
            this.element.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`;
            this.element.style.transform = `translate(-30px,-30px) rotate(${this.properties.rotate}deg) rotateY(${this.properties.rotateY}deg) scale(${this.properties.scale})`;
            return new Promise((resolve, reject) => {
                setTimeout(resolve, duration);
            });
        }
    }
    Carbon.Cursor = Cursor;
})(Carbon || (Carbon = {}));
