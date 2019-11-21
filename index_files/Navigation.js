class Navigation {
  constructor(element) {    
    this.element = element; // .navigation
    this.className = this.element.className;
  
    Navigation.instance = this;
    
    this.controller = this;

    this.surface = Surface.get(this.element);

    this.check();

    browser.navigationPresetOverride && this.swap(browser.navigationPresetOverride);
  }

  get headerEl() {
    return this.element.querySelector('header');
  }

  get navEl() {
    return this.element.querySelector('nav');
  }

  get navIconEl() {
    return this.element.querySelector('.navIcon');
  }

  get isSidenav() {
    return this.element.classList.contains('sidenav');
  }

  get isOverlay() {
    return this.element.classList.contains('overlay');
  }

  get isSticky() {
    return this.element.classList.contains('sticky');
  }


  get isOpen() {
    return document.body.classList.contains('hamburgering');
  }

  async animateOut() {
    if (this.isSidenav) return;

    this.headerEl.style.transition = 'transform 400ms cubic-bezier(0.4, 0.0, 0.2, 1), opacity 400ms ease-out';
    this.headerEl.style.transform = `translateY(-${this.height}px)`;
    this.headerEl.style.opacity = 0;
  }

  async animateIn() {
    if (this.isSidenav) return;

    if (this.animation) {
      this.animation.pause();
    }

    this.headerEl.style.transform = `translateY(0px)`;
    this.headerEl.style.opacity = 1;
  }

  check() {
    let siteEl = this.element.closest('.site');

    if (!siteEl) {      
      return;
    }

    let pageEl = siteEl.querySelector('.page');

    let firstBlockEl = siteEl.querySelector('.blocks .block');
    let firstBlockIsCover = firstBlockEl && firstBlockEl.classList.contains('cover');

    pageEl.classList.toggle('overlap', firstBlockIsCover);

    if (!this.isSidenav) {

      if (firstBlockIsCover) {
        let a = pageEl.getBoundingClientRect().top;
        let b = pageEl.querySelector('.blocks').getBoundingClientRect().top;

        let d = b - a;

        siteEl.style.setProperty('--nav-height', this.height.toString() + 'px');
        siteEl.style.setProperty('--main-top', '0px');
      }
      else {
        siteEl.style.setProperty('--main-top', this.height.toString() + 'px');
      }
    }

    this.setMinBlocksHeight(siteEl);

    this.checkContrast(getFirstVisibleBlock());
  }
  
  setMinBlocksHeight(rootEl) {
    let minBlockHeight = browser.height;

    let pageEl = rootEl.querySelector('.page');
    let blocksEl = pageEl.querySelector('.blocks');

    let footerEl = blocksEl.nextElementSibling;
    
    if (footerEl && footerEl.tagName == 'FOOTER') {
      minBlockHeight -= footerEl.offsetHeight;
    }

    minBlockHeight -= blocksEl.offsetTop;
    
    blocksEl.style.minHeight = minBlockHeight + 'px';
  }

  get isSticky() {
    let navEl = this.element.querySelector('nav');
    
    return navEl && navEl.classList.contains('sticky');
  }

  get h1El() {
    return this.element.querySelector('h1');
  }

  checkContrast(blockEl) {
    if (this.isSidenav) {
      return;
    }

    try {
      this._checkContrast(blockEl);
    }
    catch (err) {
      console.log('error checking contrast', err);
    }
  }

  _checkContrast(blockEl) {   
    if (!blockEl) return;

    let block = Block.get(blockEl);
   
    let bg = (block.top <= this.height / 2) 
      ? block.surface.compositedBg
      : contrastManager.background.isGradient ? null : contrastManager.background.color;

    if (!bg) {
      this.element.style.setProperty('--link-color', this.surface.defaultLinkColor.hex());


      return;
    }

    this.element.style.transition = 'color 100ms ease-out';

    this.element.style.setProperty('--link-color', adjustColor(bg, this.surface.defaultLinkColor).hex());
  }

  reset() {
    this.element.style.transition = null;
  }
  
  get height() {
    return this.headerEl.scrollHeight;
  }

  get overlayEl() {
    return this.element.querySelector('.overlay');
  }

  open() {
    document.body.classList.add('hamburgering');

    this.overlayEl.classList.add('open');
 
    this.headerEl.style.height = null;
      
    let overlaySurface = Surface.get(this.overlayEl);
    let smartLinkColor = overlaySurface.smartLinkColor.hex();
   
    this.navIconEl.style.setProperty('--link-color', smartLinkColor);
    this.overlayEl.style.setProperty('--link-color', smartLinkColor);
  }

  close() {
   this.overlayEl.classList.remove('open');

   this.navIconEl.style.setProperty('--link-color', null);

   document.body.classList.remove('hamburgering');

   this._checkContrast();
  }

  toggle() {
    this[this.isOpen ? 'close' : 'open']();
  }

  async swap(presetId) {
    let html = await getHTML('/components/Navigation?presetId=' + presetId);

    let newEl = DUM.parse(html);

    this.element.className = newEl.className;
    this.element.innerHTML = newEl.innerHTML;

    this.check(this.containerEl);
  }
}

Carbon.controllers['nav'] = {
  setup(e) {
    navigation = new Navigation(e.target);

    if (navigation.isSidenav) {
      document.body.classList.add('no-overscroll');
    }
  },

  open(e) {
    navigation.open();
  },

  close(e) {
    navigation.close();
  },

  toggle(e) {
    navigation.toggle();    
  }
};

function getFirstVisibleBlock() {
  return document.querySelector('.block.visible') || document.querySelector('.block');
  
}