class Block {
  static get(element) {
    return Block.instances.get(element) || new Block(element);
  }

  static get active() {
    let el = document.querySelector('.block.active');

    if (el) {
      return Block.get(el);
    }
    
    return null;
  }

  constructor(element) {
    this.element = element;

    this.id = this.element.dataset['id'];

    Block.instances.set(this.element, this);

    blockObserver.observe(this.element);

    for (var videoEl of this.element.querySelectorAll('video[autoplay]')) {
      videoObserver.observe(videoEl);
    }

    this.setup();
  }

  get top() {
    return this.element.getBoundingClientRect().top;
  }

  get isFirst() {
    return this.element.previousElementSibling === null;
  }
  
  onScroll(e) {
    if (this.isCover && this.backgroundEl) {          
      
      if (this.isFirst && browser.scrollTop == 0) {
        this.backgroundEl.style.transform = null;

        return;
      }

      this.backgroundEl.style.transform = 'translateY(' + (- this.top / 2) + 'px)'; 
    }
  }

  get backgroundEl() {
    return this.element.querySelector('.background');
  }

  get surface() {
    return Surface.get(this.element);
  }

  async setup() { 
    await this.check();

    if (this.top < window.innerHeight) {
      this.onScroll();
    }
  }

  get isCover() {
    return this.element.classList.contains('cover');
  }

  async check() {
    let fittyEls = this.element.querySelectorAll('.fitty');

    if (fittyEls.length > 0) {
      for (var fittyEl of fittyEls) {
        if (fittyEl.fitty) {      
          return;
        }
    
        setupFitty(fittyEl);
      }
      
      fittyEl.fitty.fit();
    }
    
    let containerEl = this.element.querySelector('.container');
  
    containerEl && containerEl.classList.add('fadeIn');
  }
  
  get path() {
    return `/blocks/${this.id}`;
  }

  async onInsectionChange(e) {        
    if (e.intersectionRatio == 0) {
      this.onOutOfView(e);
    }
    else if (e.intersectionRatio > 0.5 || e.intersectionRect.height > 50) {
      this.onInView();
    }
  }

  onOutOfView(e) {
    if (!this.element.classList.contains('visible')) return;

    this.element.classList.remove('visible');

    for (var playerEl of this.element.querySelectorAll('carbon-player.autoplay.playing')) {
      Carbon.MediaPlayer.get(playerEl).pause();
    }    
  }

  onInView() {
    if (this.element.classList.contains('visible')) return;

    this.onScroll();

    this.element.classList.add('visible');

    this.element.classList.contains('animated') && this.animateIn();

    for (var playerEl of this.element.querySelectorAll('carbon-player.autoplay')) {
      Carbon.MediaPlayer.get(playerEl).play();
    }
  }

  animateIn() {
    this.element.classList.remove('animated');
  
    return delay(500);
  }

  get bounds() {
    return this.element.getBoundingClientRect();
  }
}

Carbon.controllers['block'] = {
  setup(e) {
    Block.get(e.target);
  }
}

Carbon.controllers['privateBlock'] = {
  setup(e) {

    var form = new Carbon.Form(e.target.querySelector('form'));

    form.on('sent', e => {

      browser.load(document.location.pathname, { force: true });

      // TODO: load in the blocks
      
    });

  }
}


Block.instances = new WeakMap();

const blockObserver = new IntersectionObserver(entries => {
  for (var entry of entries) {
    let block = Block.get(entry.target);
    
    block && block.onInsectionChange(entry);
  }
}, {
    rootMargin:  '0px 0px',
    threshold: [ 0, 0.005, 0.01, 0.02, 0.03, 0.04, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1 ]
});

const videoObserver = new IntersectionObserver(entries => {
  for (var entry of entries) {
    let videoEl = entry.target;
    
    if (entry.intersectionRatio == 0) {  
      videoEl.pause();
    }
    else {
      videoEl.play();
    }
  }
}, {
    rootMargin:  '0px 0px',
    threshold: [ 0, 0.005, 0.01, 0.02, 0.03, 0.04, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1 ]
});



