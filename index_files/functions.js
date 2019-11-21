
let webpSupport = undefined // so we won't have to create the image multiple times

const webp1Px = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA'

function isWebpSupported () {
  if (webpSupport !== undefined) {
    return Promise.resolve(webpSupport)
  }

  return new Promise((resolve, _reject) => {
    const img = new Image()
    img.onload = () => {
      webpSupport = !!(img.height > 0 && img.width > 0);
      resolve(webpSupport)
    }
    img.onerror = () => {
      webpSupport = false
      resolve(webpSupport)
    }
    img.src = webp1Px
  })
}

isWebpSupported();

async function getHTML(url) {
  let accept = 'text/html';

  if (webpSupport) {
    accept += ',image/webp';
  }
  
  let response = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { 'Accept': accept }
  });
  
  return await response.text();
}


let UserSelect = {
  _prevent(e) { 
   e.preventDefault();
   e.stopPropagation();
  },
  
  block() {
    if (UserSelect.active) return;

    UserSelect.active = true;

    document.body.focus();
    
    document.addEventListener('selectstart', UserSelect._prevent, true);
  },
  
  unblock() {
    document.removeEventListener('selectstart', UserSelect._prevent, true);

    UserSelect.active = false;
  }    
};

function rectContains(rect, point) {
    return rect.x <= point.x && point.x <= rect.x + rect.width &&
           rect.y <= point.y && point.y <= rect.y + rect.height;
}

function isAncestor(target, containerEl) {
  var el = target;

  for ( ; el && el !== document; el = el.parentNode ) {
    if ( el === containerEl) {        
      return true;
    }
  }

  return false;
}

function getVisibility(el, viewportEl) {

  // console.log('get visibility', el);

  let viewportHeight = viewportEl.clientHeight;
  let viewportWidth = viewportEl.clientWidth;

  // { top: 106, bottom: -562, position: {…}, height: 831 }

  let top = 0;
  let left = 0;

  let current = el;

  while (current !== viewportEl && current) {
    top += current.offsetTop;
    left += current.offsetLeft;

    current = current.offsetParent;
  }

  // relative position to viewport origin
  let position = { top, left };

  let distanceFromTop = position.top - viewportEl.scrollTop;


  let visibleHeight = Math.min(el.clientHeight, viewportHeight);
  let visibleWidth = Math.min(el.clientWidth, viewportWidth);


  let relativeTop = position.top - viewportEl.scrollTop; // to viewport
  let relativeBottom = viewportHeight - (distanceFromTop + el.clientHeight);

  let diff = viewportHeight - relativeTop - relativeBottom;
 
  if (diff > visibleHeight) {
    if (relativeTop > 0) {
      visibleHeight -= relativeTop;
    }

    if (relativeBottom > 0) {
      visibleHeight -= relativeBottom;
    }
  }

  else { 
    if (relativeTop < 0) {
      visibleHeight += relativeTop;
    }
  }

  return { 
    top      : relativeTop,
    bottom   : relativeBottom,
    position : position,

    intersectionRatio: visibleHeight / el.clientHeight,
    
    viewport: { 
      width: viewportWidth,
      height: viewportHeight
    },

    height: visibleHeight,
    width: visibleWidth
  };
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

let DUM = {
  parse(text) {
    let parser = new DOMParser();

    let dom = parser.parseFromString(text, 'text/html');

    return dom.body.childNodes[0];
  },

  detach(node) {
    var parent = node.parentNode;

    // No parent node? Abort!

    if (!parent) return;
    
    // Detach node from DOM.
    parent.removeChild(node);

    return node;
  }
};

function clamp(val, min, max) {
  if (val < min) return min;
  if (val > max) return max;

  return val;
}

function setupFitty(el) { 
  let maxSize = el.dataset['maxFontSize'] ? parseFloat(el.dataset['maxFontSize']) : 500;
 
  let controller = fitty(el, { 
    maxSize: maxSize
  });
  
  controller.fontSize = el.style.fontSize;

  el.fitty = controller;

  el.style.visibility = 'visible';
}


// https://github.com/rikschennink/fitty
