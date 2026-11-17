/* Reset inner scrolling when navigating between the single/two-stage pages. */
document.addEventListener("click",event=>{
  const target=event.target.closest("[data-page],[data-page-target],[data-page-link]");
  if(target)requestAnimationFrame(()=>{
    document.querySelectorAll(".page.active").forEach(page=>{page.scrollTop=0});
  });
});
