class Gallery {
  constructor(element, options) {
    this.element = element;
    this.index = 0;
  
    this.element.controller = this;

    this.carousel = new Carousel(this.viewportEl, options);

    this.carousel.view(0);

    this.onResizeFn = this.onResize.bind(this);

    window.addEventListener('resize', this.onResizeFn, { passive: true });

    this.onResize();
  }

  get viewportEl() {
    return this.element.querySelector('.viewport');
  }

  get contentEl() {
    return this.element.querySelector('.content');
  }

  get dotsEl() {
    return this.element.querySelector('.dots');
  }

  get width() {
    return this.element.clientWidth;
  }

  onResize() {
    this.onAnimateFrameRequest = window.cancelAnimationFrame(this.onAnimateFrameRequest);
    
    this.onAnimateFrameRequest = window.requestAnimationFrame(() => {
      this._onResize();
    });
  }

  _onResize() {
    if (!this.element || !this.element.isConnected) {
      window.removeEventListener('resize', this.onResizeFn, { passive: true });

      return;
    }

    let minAspect = 0; // the the tallest aspect ratio...

    for (var slide of this.carousel.slides) {
      if (minAspect == 0 || slide.aspect < minAspect) {
        minAspect = slide.aspect;
      }
    }

    let maxBlockHeight = this.element.closest('.fluid') ? browser.height : 800;

    let maxHeight = Math.min(this.width / minAspect, maxBlockHeight);

    this.element.style.height = maxHeight + 'px';

    let parentEl = this.element.closest('.blocks');
    
    let parentWidth = parentEl ? parentEl.clientWidth : app.gridWidth;
    
    let inset = parentWidth < app.gridWidth + 300;
  
    this.element.classList.toggle('inset', inset);
  
    this.check();
  }

  async prev() {
    await this.view(this.carousel.index - 1);
  }

  async next() {
    await this.view(this.carousel.index + 1);
  }

  get itemCount() {
    return this.carousel.slides.length;
  }

  clear() {
    this.carousel.clear();
  }

  check() {
    this.carousel.check();
  }

  async add(item) {
    let html = await getHTML(`/blocks/${item.blockId}/items/${item.number}?template=slide`);
        
    this.carousel.appendSlideHTML(html);

    this.onResize();
  }

  async view(index) {
    Gallery.active = this;
    
    this.carousel.view(index);

    if (this.dotsEl) {
      let selectedDotEl = this.dotsEl.querySelector('.selected');

      selectedDotEl && selectedDotEl.classList.remove('selected');

      this.dotsEl.children[this.carousel.index].classList.add('selected');
    }
  }
} 

class Carousel {
  constructor(element, options) {
    this.element = element;
    this.contentEl = this.element.querySelector('.content');

    this.duration = 300;
    this.easing = 'cubicBezier(0.4, 0.0, 0.2, 1)';
    this.left = 0;
    this.index = 0;
    this.options = options || { };

    this.slides = [ ];

    let i = 0;

    for (var slideEl of Array.from(element.querySelectorAll('carbon-slide'))) {
      this.slides.push(new Slide(slideEl, i, this));

      i++;
    }
    // init

    this.gestures = new Carbon.Gestures.Manager(element);

    // left + right only = 6
		this.gestures.add(new Carbon.Gestures.Pan({ velocity: 0.00001, direction: 6, threshold: 1 } ));

    this.gestures.on("panstart", this.onPanStart.bind(this));
    this.gestures.on("panend", this.onPanEnd.bind(this));
    this.gestures.on("pan", this.onPan.bind(this));

  }

  get gap() {
    return parseInt(this.element.closest('.gallery').style.getPropertyValue('--gap-x'));
  }

  onPanStart(e) {
  }

  onPanEnd(e) {
    this.active = false;    

    this.element.style.transform = `translateX(0px)`;    

    let newIndex = this.index;
    
    if (e.deltaX > 50) {
      newIndex--;
    }
    else if (e.deltaX < -50) {
      newIndex++;
    }
    
    if (newIndex < 0 || newIndex > this.slides.length - 1 || newIndex == this.index) {

      // revert
      let slide = this.slides[this.index];

      this.animation = anime({
        targets    : this.contentEl,
        translateX : - slide.left,
        duration   : 300
      });

      return;
    }

    this.view(newIndex);
  }

  onPan(e) {
    let slide = this.slides[this.index];

    anime.set(this.contentEl, {
      translateX : - slide.left + e.deltaX,
    });
  }

  clear() {
    this.slides = [ ];

    for (var slideEl of this.element.querySelectorAll('carbon-slide')) {
      slideEl.remove();
    }
  }

  appendSlideHTML(html) {
    var slideEl = DUM.parse(html);

    slideEl.classList.toggle('first', this.slides.length == 0);

    slideEl.style.setAttribute('--index', this.slides.length.toString());
    
    this.contentEl.appendChild(slideEl);    

    this.slides.push(new Slide(slideEl, this.slides.length, this));
  
    this.view(this.slides.length - 1, false);
  }

  check() {
    if (this.slides.length == 0) return;
    
    let slide = this.slides[this.index];
    
    this.contentEl.style.transform = `translateX(-${slide.left}px)`;
  }

  onPanMove(e) {
    if (!this.active) return;
  }

  get bounds() {
    return this.element.getBoundingClientRect();
  }
  
  get width() {
    return this.bounds.width;
  }

  async view(index) {
    if (index < 0 || index > this.slides.length - 1) {
      
      await this.bump(index > 0 ? 'right' : 'left');
      
      return;
    }
    
    // init

    if (this.index == 0 && index == 0) {
      this.slides[0].load();
      
      if (this.options.preload !== false && this.slides.length > 1) {
        this.slides[1].load();
      }

      return;
    }

    if (this.index < index) {
      await this.forwards(index);
    } 
    else {
      await this.backwards(index);
    }
  }

  get viewportWidth() {
    return this.element.clientWidth;
  }

  get scrollWidth() {
    return this.element.scrollWidth;
  }

  getCurrentTransform() {
    return getComputedStyle(this.contentEl).transform;
  }

  async forwards(index = null) {
    // await this.beforeAnimation();

    if (index) {
      this.index = index;
    } 
    else {
      this.index++;
    }

    this.animating = true;

    let slide = this.slides[index];

    slide.load();

    // TODO: pause and adjust current animation

    if (this.animation) {
      this.animation.pause();
    }

    this.animation = anime({
      targets    : this.contentEl,
      translateX : - slide.left,
      duration   : this.duration,
      easing     : this.easing
    });

    await this.animation.finish;

    this.afterAnimation();

    this.animating = false;

    // TOOD: remove the last slide and append the next slide to the end
  }

  async backwards(index = null) {
    if (this.index == 0) return;

    if (index) {
      this.index = index;
    } 
    else {
      this.index--;
    }
    
    let slide = this.slides[index];

    slide.load();

    this.animating = true;
        
    this.animation && this.animation.pause();
    
    this.animation = anime({
      targets    : this.contentEl,
      translateX : -slide.left,
      duration   : this.duration,
      easing     : this.easing
    });

    await this.animation.finish;

    this.afterAnimation();
    
    this.animating = false;
  }

  async beforeAnimation() {
    let left = -(this.index * this.viewportWidth);

    this.contentEl.style.transform = `translateX(${left}px))`;
  }

  afterAnimation() {  

  }

  async bump(direction) {
    if (this.animation) {
      this.animation.pause();
    }

    let distance = direction == 'right' ? -100: 100;   

    let left = -(this.index * this.viewportWidth + (this.gap * this.index));

    if (this.animation && this.animation.playState == 'running') {
      this.animation.playbackRate = 5;
      
     await new Promise(r => { this.animation.onfinish = r });
    }

    this.animation = anime({
      targets    : this.contentEl,
      translateX : [ left, left + distance, left ],
      duration   : 200,
      easing     : this.easing
    });

    await this.animation.finish;

    this.afterAnimation();
  }
}

class Slide {
  constructor(element, index, carousel) {
    this.element = element;

    this.duration = 400;
    this.index = index;
    this.carousel = carousel;
    this.animating = false;

    this.element.classList.add(this.aspect >= 1 ? 'wide' : 'tall');
  }

  get aspect() {
    try {
      return parseFloat(this.element.dataset['aspect']);
    }
    catch (ex) {
      return 16 / 9; 
    }
  }

  load() {
    // TODO: load the image
  }

  get left() {
    return this.index * this.carousel.viewportWidth + (this.carousel.gap * this.index);
  }
}

document.addEventListener('keydown', e => {
  let gallery = Gallery.active;

  if (!gallery) return;

  switch (e.keyCode) {
    case 39: gallery.next(); break; // right
    case 37: gallery.prev(); break; // left
  }
});

Carbon.controllers['gallery'] = {
  setup(e) {
    let options = { 
      preload: !!e.target.closest('.site')
    };

    let gallery = new Gallery(e.target, options);

    if (e.target.closest('.site')) {
      Gallery.active = gallery;
    }
  },

  view(e) {
    let galleryEl = e.target.closest('.gallery');

    galleryEl && galleryEl.controller.view(parseInt(e.target.dataset['index']));
  },

  next(e) {
    let galleryEl = e.target.closest('.gallery');

    galleryEl && galleryEl.controller.next();
  },

  prev(e) {
    let galleryEl = e.target.closest('.gallery');

    galleryEl && galleryEl.controller.prev();
  }
}