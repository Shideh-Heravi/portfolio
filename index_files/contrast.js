class Background {
  constructor() { }

  get isGradient() {
    return this.image && this.image.startsWith('linear-gradient')
  }
}

class ContrastManager {
  constructor() {
    this.surfaces = [ ];
    this.background = new Background();
    this.minContrast = parseFloat(document.body.dataset['minContrast']);
  }

  setup(rootEl) {
    this.surfaces = [ ];

    this.background = this.browser.background;

    this.setBackgroundColor(this.background.color);

    this.setColor(getColor(rootEl.querySelector('.page')));
  
    for (var surfaceEl of rootEl.querySelectorAll('.block, .surface')) { 
      if (surfaceEl.matches('.portfolio')) continue;

      this.addSurface(Surface.get(surfaceEl));
    }

    this.check();
  }

  addSurface(surface) {
    surface.parent = this;

    this.surfaces.push(surface);
  }

  setBackgroundColor(value) {
    this.background.color = value;

    try {
      document.documentElement.style.backgroundColor = value.hex();

      document.body.classList.toggle('light', value.luminance() > 0.5);     
    }
    catch (ex) { }
  }

  setColor(value) {
    this.color = value;
  }

  check() {    
    try {      
      Navigation.instance && Navigation.instance.checkContrast(getFirstVisibleBlock());
  
      for (var surface of this.surfaces) {
        try {
          surface.check(this);
        }
        catch (err) { 
          console.log('surface color check error', err);
        }
      }
    }
    catch (err) {
       console.log('general contrast error', err);
    }
  }
}


const contrastManager  = new ContrastManager();

function getColor(el) {
  if (!el) return null;

  return chroma(window.getComputedStyle(el).color);
}

function getBackgroundColor(el) {
  try {
    return chroma(window.getComputedStyle(el).backgroundColor);
  }
  catch (ex) {
    return null;
  }
}

class Surface {
  constructor(element) {
    this.element = element;

    this.backgroundColor = getBackgroundColor(element); 

  
    let style = window.getComputedStyle(this.element);

    this.accentColorIsDynamic = !this.element.style.getPropertyValue('--default-accent-color')
    this.defaultColor         = chroma(style.getPropertyValue('--default-color').trim());
    this.defaultAccentColor   = chroma(style.getPropertyValue('--default-accent-color').trim());
    this.defaultLinkColor     = chroma(style.getPropertyValue('--default-link-color').trim());
  }

  get compositedColor() {
    return this.defaultColor || contrastManager.color; // this.parent.color;
  }

  get smartLinkColor() {
    return adjustColor(this.compositedBg, this.defaultLinkColor);
  }

  get compositedBg() {
    if (this.isTransparent) {
      if (!this.parent) {
        return browser.background.color;
      }

      if (this.parent.background.isGradient) return null;

      return this.parent.background.color;
    }

    return this.backgroundColor;
  }

  get isTransparent() {
    return this.backgroundColor.alpha() == 0;
  }

  check() {
    let bg = this.compositedBg;
    
    if (!bg) return;

    let colorContrast = getContrast(bg, this.compositedColor);

    let insufficientContrast = colorContrast < contrastManager.minContrast;

    this.element.style.setProperty('--color', insufficientContrast
      ? adjustColor(bg, this.compositedColor).hex() 
      : null
    );   

    if (this.accentColorIsDynamic) {
      let adjustedAccentColor = adjustColor(bg, this.defaultAccentColor);

      this.element.style.setProperty('--accent-color', adjustedAccentColor.hex());
    }
    
    this.element.style.setProperty('--link-color', adjustColor(bg, this.defaultLinkColor).hex());  
  }
}

Surface.get = function(el) {
  if (!el.surfaceController) {
    el.surfaceController = new Surface(el);
  }

  return el.surfaceController;
}

function getContrast(bg, fg) {
  return (chroma.contrast(bg, fg) - 1) / 20; // 0 - 21;
}

function adjustColor(bg, fg) {
  if (!bg) return fg;

  let contrast = getContrast(bg, fg); // 0 - 21

  const amount = 5;

  if (contrast < contrastManager.minContrast) {
    if (bg.luminance() > 0.175) {
      // better dark
      // check if BG is colorful and if we need to adjust the hue
  
      fg = fg.darken(amount);
    }
    else {
      // better light
      fg = fg.brighten(amount);
    }
  }
  
  return fg; // unmodified
}