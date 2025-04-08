---
# 🌐 Live Demo

## What You’ll See

- A fully portable HTML site
- Every internal page inlined
- No external requests

---

## Example Output

> Download this page and open it offline. It works!

<!-- [Download Demo Portable HTML](./bootstrap-packed.html) -->

---

## How It Was Generated

```bash
portapack -i https://getbootstrap.com --recursive --max-depth 1 -o bootstrap-packed.html
```

---

## Client-Side Navigation

Recursively packed pages are wrapped in `<template>` blocks with an embedded router.

```html
<template id="page-home">
  <h1>Homepage</h1>
</template>
<template id="page-about">
  <h1>About</h1>
</template>
```

```js
window.addEventListener('hashchange', () => {
  const id = location.hash.replace('#', '') || 'home';
  showPage(id);
});
```
