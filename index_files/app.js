let page = null;
let lazyLoader = new Carbon.LazyLoader();

class App {  
  constructor() {
    this.router = new Carbon.Router({
      '/'       : new Page('home', this),
      '/{slug}' : new Page('*', this)
    });

    this.router.beforeNavigate = this.beforeNavigate.bind(this);
    
    document.querySelector('.page').classList.remove('loading');
  
    this.gridWidth = parseInt(getComputedStyle(document.body).getPropertyValue('--grid-width'));
  }

  start() {
    this.onDOMMutation();

    this.router.start();
  }

  onDOMMutation() {
    let els = Array.from(document.querySelectorAll('[on-insert]'));

    for (var el of els) {
      Carbon.ActionKit.dispatch({
        type   : 'insert',
        target : el
      });
  
      el.removeAttribute('on-insert');
    }

    contrastManager.check();
    
    lazyLoader.setup();
  }

  beforeNavigate(e) {   

    if (e.url == document.location.pathname) { // same
      if (Navigation.instance && Navigation.instance.isOpen) {
        Navigation.instance.close();
      }
      else {
        // TODO: Enumulate smooth scrolling on Safari
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      return false;
    }

    if (e.clickEvent && e.clickEvent.target.closest('a')) {
      if (e.clickEvent.target.closest('.block.active') || 
          e.clickEvent.target.closest('a').hasAttribute('disabled')) {
        return false;
      }
    }
    
    if (!e) return;

    let target = e.target;

    if (!target) return;

    selectLink(target.pathname);
    
    return true;
  }

  navigate(path) {
    this.router.navigate(path);
  }

  load(cxt) {
    this.path = cxt.url;

    if (cxt.init) {
      this.onLoaded();

      return Promise.resolve(true);
    }

    return this._load(cxt.url, true);
  }

  async _load(path, notify) {
    let same = path == this.path;

    this.path = path;
        
    let url = path + (path.indexOf('?') > -1 ? '&' : '?' ) + 'partial=true';    


    if(Navigation.instance && Navigation.instance.isOpen) {
      await Navigation.instance.close();
    } 

    if (!same) {
      browser.load(path, notify);
    }
  }
}


function selectLink(pathname) {
  let activeLinkEls = document.querySelectorAll('a.active');

  for (var activeLinkEl of activeLinkEls) {
    activeLinkEl.classList.remove('active');
  }

  let linkEls = document.querySelectorAll(`a[href='${pathname}']`);

  for (var linkEl of linkEls) {

    if (linkEl.firstElementChild && linkEl.firstElementChild.tagName == 'H1') {

      continue;
    }

    linkEl.classList.add('active');
  }
}

selectLink(document.location.pathname);

Carbon.ActionKit.observe('click', 'change');

class Page {
  async load(cxt) {        
    if (cxt.init) return; // Skip animation on initial page load

    await app._load(cxt.path);
  }

  unload(cxt) {
    return true;
  }
}

const app = new App();

let browser = new Browser(document.body);

app.start();

Carbon.controllers['browser'] = browser;


if ('ontouchstart' in window) {
  app.cursor = null;
}
else {
  document.body.classList.add('custom-cursor');
  
  app.cursor = Carbon.Cursor.create({ blendMode: 'none', scale: 0.7, type: 'zoom-in' });

  app.cursor.start();
}

app.lightbox = Carbon.Lightbox.get({ cursor: app.cursor });

app.lightbox.reactive.on('open', e => {  
  e.element.style.setProperty('--background-color', contrastManager.background.color.hex());
});