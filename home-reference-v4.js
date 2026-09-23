/* Decorative home images only. No data reads, storage, prediction or navigation changes. */
(()=>{'use strict';
 const sources={
  "10": "https://www.boatrace.jp/static/uploads/sites/8/10_N-1-1.jpg",
  "11": "https://www.boatrace.jp/static/uploads/sites/8/11_N-1.jpg",
  "12": "https://www.boatrace.jp/static/uploads/sites/8/12_N-1-1.jpg",
  "13": "https://www.boatrace.jp/static/uploads/sites/8/13_N-1.jpg",
  "14": "https://www.boatrace.jp/static/uploads/sites/8/14_N-1.jpg",
  "15": "https://www.boatrace.jp/static/uploads/sites/8/15_N-1.jpg",
  "16": "https://www.boatrace.jp/static/uploads/sites/8/16_N-1.jpg",
  "17": "https://www.boatrace.jp/static/uploads/sites/8/17_N-1.jpg",
  "18": "https://www.boatrace.jp/static/uploads/sites/8/18_N-1.jpg",
  "19": "https://www.boatrace.jp/static/uploads/sites/8/19_N-1.jpg",
  "20": "https://www.boatrace.jp/static/uploads/sites/8/20_N-1.jpg",
  "21": "https://www.boatrace.jp/static/uploads/sites/8/21_N-1.jpg",
  "22": "https://www.boatrace.jp/static/uploads/sites/8/22_N-1-1.jpg",
  "23": "https://www.boatrace.jp/static/uploads/sites/8/23_N-1.jpg",
  "24": "https://www.boatrace.jp/static/uploads/sites/8/24_N-1.jpg",
  "01": "https://www.boatrace.jp/static/uploads/sites/8/01_N.jpg",
  "02": "https://www.boatrace.jp/static/uploads/sites/8/02_N-1.jpg",
  "03": "https://www.boatrace.jp/static/uploads/sites/8/03_N-1.jpg",
  "04": "https://www.boatrace.jp/static/uploads/sites/8/04_N-1.jpg",
  "05": "https://www.boatrace.jp/static/uploads/sites/8/05_N-1.jpg",
  "06": "https://www.boatrace.jp/static/uploads/sites/8/06_N-1.jpg",
  "07": "https://www.boatrace.jp/static/uploads/sites/8/07_N-1.jpg",
  "08": "https://www.boatrace.jp/static/uploads/sites/8/08_N-1.jpg",
  "09": "https://www.boatrace.jp/static/uploads/sites/8/09_N-1-1.jpg"
};
 function decorate(){
  if(!document.body.classList.contains('reference-home'))return;
  document.querySelectorAll('#venueGrid .venue[data-venue]').forEach(card=>{
   const src=sources[card.dataset.venue];if(!src||card.querySelector('.home-venue-photo'))return;
   const img=document.createElement('img');img.className='home-venue-photo';img.alt='';img.setAttribute('aria-hidden','true');img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
   img.onload=()=>{img.classList.add('loaded');card.classList.add('venue-photo-loaded')};img.onerror=()=>img.remove();img.src=src;card.prepend(img);
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
})();

