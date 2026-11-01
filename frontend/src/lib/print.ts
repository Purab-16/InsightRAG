/**
 * Opens the browser's print dialog ("Save as PDF"). The page title becomes the default file name.
 * Print styles in globals.css hide the app chrome and switch to light colours.
 */
export function printPage(title: string) {
  const previous = document.title;
  const restore = () => {
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  document.title = title;
  window.addEventListener("afterprint", restore);
  window.print();
}
