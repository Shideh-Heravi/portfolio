// ON LOAD
// ON UNLOAD
// IN VIEW
// OUT OF VIEW
// In

let pageTransition = {
  async animateOut(pageEl) {    
    Navigation.instance.reset();
    Navigation.instance.animateOut();

    let blocksEl = pageEl.querySelector('.blocks');
      
    blocksEl.style.transform = 'translateY(-60px)';
    blocksEl.style.opacity = 0;
  
    return await delay(500);
  },

  async animateIn(pageEl) {
    
    let blocksEl = pageEl.querySelector('.blocks');

    blocksEl.style.transition = 'none';

    blocksEl.style.transform = null; // 'translateY(0)';
 
    setTimeout(() => {
      blocksEl.style.transition = null;
      blocksEl.style.opacity = 1;
    }, 1);

    Navigation.instance.animateIn();

    Navigation.instance.check();

    await delay(500);
  }
}