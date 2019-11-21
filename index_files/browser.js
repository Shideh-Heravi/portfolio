let iOS = !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform);

class Browser {
  constructor(element) {
    this.element = element;

    this.siteEl = document.body;
    this.pageEl = document.querySelector('.page');

    this.path = document.location.pathname;

    this.viewportEl = document.body;

    this.scrollable = {
      element: document.body
    };
    
    this.reactive = new Carbon.Reactive();

    window.addEventListener('resize', this.onResize.bind(this), {
      passive: true
    });

    window.addEventListener('scroll', this.onScroll.bind(this), {
      passive: true,
      capture: false
    });

    this.forcePhone = document.body.classList.contains('phone');

    this.onResize();
    
    contrastManager.browser = this;

    contrastManager.setup(document.body);

    window.addEventListener('focus', this.onFocus.bind(this), false);
  }

  onFocus() {    
    this.onResize();
  }

  on(type, callback) {
    this.reactive.on(type, callback);
  }

  async load(path, options = { }) {
    if (this.path == path && options.force !== true) {
      return;
    }
    
    this.path = path;

    let accept = webpSupport ? 'text/html,image/webp' : 'text/html';

    let headers = {
      'Accept': accept,
      'x-partial': 'true'
    };

    let animate = options.animate !== false;

    let request = fetch(path, { 
      credentials: 'same-origin',
      headers: headers
    });

    let pageEl = document.querySelector('.page');

    animate && await pageTransition.animateOut(pageEl);

    let response = await request;
    
    document.title = decodeURI(response.headers.get("x-title") || '');

    let el = DUM.parse(await response.text());

    pageEl.querySelector('.blocks').innerHTML = el.querySelector('.blocks').innerHTML;
    
    pageEl.setAttribute('style', el.getAttribute('style'));

    pageEl.className = el.className;
    pageEl.classList.remove('loading')
    pageEl.id = el.id;

    app.onDOMMutation();

    browser.doResize();

    document.body.scrollTop = 0;      

    contrastManager.setup(document.body);

    animate && await pageTransition.animateIn(pageEl);

    return true;
  }

  get background() {
    let style = window.getComputedStyle(this.pageEl);

    let background = new Background();

    background.image = style.backgroundImage;

    try {
      let bg = chroma(style.backgroundColor);
      
      background.color = (bg.alpha() == 0) ? chroma('#fff') : bg;
    }
    catch (err) { }

    
    return background;
  }
  
  async reload(options = { }) {
    if (options.animate === undefined) {
      options.animate = false;
    }

    if (options.force === undefined) {
      options.force = false;
    }

    await this.load(this.path, options);
  }

  get width() {
    return this.scrollable.element.clientWidth;
  }

  get height() {
    return this.scrollable.element.clientHeight;
  }

  get scrollTop() {
    return this.element.scrollTop;
  }

  set scrollTop(value) {
    this.element.scrollTop = value;
  }

  onScroll(e) {
    this.onScrollFrameRequest = window.cancelAnimationFrame(this.onScrollFrameRequest);
    
    this.onScrollFrameRequest = window.requestAnimationFrame(() => {
      let firstVisibleBlockEl = getFirstVisibleBlock();

      Navigation.instance && Navigation.instance.checkContrast(firstVisibleBlockEl);
  
      for (var visibleBlockEl of document.querySelectorAll('.block.visible')) {        
        Block.get(visibleBlockEl).onScroll(e);
      }

      this.setBrowserControlHeight();
    });
  }

  setBrowserControlHeight() {
    if (!iOS) return;

    let bottomHeight = window.outerHeight - window.innerHeight;

    document.body.style.setProperty('--browser-bar-height', bottomHeight + 'px'); 
  }

  onResize() {
    this.onResizeFrameRequest = window.cancelAnimationFrame(this.onResizeFrameRequest);

    this.onResizeFrameRequest = window.requestAnimationFrame(() => {
      let blocksEl = this.element.querySelector('.blocks');

      this.setBrowserControlHeight();
     

      if (!this.forcePhone) {
        let breakpoint = this.breakpointName;

        if (!document.body.classList.contains(breakpoint)) {

          let isPhone = breakpoint == 'phone';
          
          // 3 = Hamburger
          let presetId = isPhone ? 3 : null;

          Navigation.instance.element.style.visibility = 'hidden';
          Navigation.instance.swap(presetId);
          Navigation.instance.element.style.visibility = null;
          
          this.navigationPresetOverride = presetId;

          document.body.classList.toggle('phone', isPhone); 
          document.body.classList.toggle('desktop', !isPhone);
        }
      }

      let value = blocksEl.offsetWidth < app.gridWidth ? (blocksEl.offsetWidth + 'px') : null;

      document.body.style.setProperty('--container-width', value); 

      this.doResize();
    });
  }

  get breakpointName() {
    return window.innerWidth <= 600 ? 'phone' : 'desktop';
  }

  isDesktop() {
    return !document.body.classList.contains('phone');
  }

  isPhone() {
    return document.body.classList.contains('phone');
  }

  doResize() {
    for (let fittyEl of document.querySelectorAll('.fitty')) {
      fittyEl.fitty.fit();
    }
  }
}