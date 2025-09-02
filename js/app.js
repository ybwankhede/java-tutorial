// ---------- Utilities ----------
const el = (tag, attrs = {}, html) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k === "dataset") Object.assign(n.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.substring(2), v);
    else n.setAttribute(k, v);
  });
  if (html !== undefined) n.innerHTML = html;
  return n;
};

const isLeaf = (node) => typeof node.page === "string" && !node.children;
const normId = (s) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");

// ---------- Build Menus from topics.json ----------
fetch("topics.json")
  .then(r => r.json())
  .then(data => {
    const topics = data.topics || data; // allow either format
    buildSidebarTree(topics, document.getElementById("sideTree"));
    buildMobileTree(topics, document.getElementById("mobileTree"));
    buildTopMenu(topics, document.getElementById("topMenu"));
  });

// ---------- Dynamic content loader ----------
async function loadPage(url, push = true) {
  try {
    if (url.includes('graph')) {
        window.open(url, '_blank');
    } else {
      const res = await fetch(url);
      const html = await res.text();
      document.getElementById("contentArea").innerHTML = html;  
    }
    
    // close offcanvas on mobile after navigation
    const offcanvasEl = document.querySelector(".offcanvas.show");
    if (offcanvasEl) bootstrap.Offcanvas.getInstance(offcanvasEl)?.hide();

    // mark active in both trees
    document.querySelectorAll(".tree-nav a.tree-item").forEach(a => a.classList.remove("active"));
    document.querySelectorAll(`.tree-nav a.tree-item[data-url="${CSS.escape(url)}"]`).forEach(a => a.classList.add("active"));

    // optional history
    if (push) history.pushState({ url }, "", window.location.pathname + "#" + url);
  } catch {
    document.getElementById("contentArea").innerHTML = `<div class="alert alert-warning">Content not found: <code>${url}</code></div>`;
  }
}
window.addEventListener("popstate", (e) => {
  const url = location.hash?.slice(1);
  if (url) loadPage(url, false);
});

// ---------- Sidebar (desktop) tree ----------
function buildSidebarTree(nodes, mount) {
  mount.innerHTML = "";
  mount.appendChild(makeUL(nodes));

  function makeUL(arr) {
    const ul = document.createElement("ul");
    arr.forEach(node => ul.appendChild(makeLI(node)));
    return ul;
  }

  function makeLI(node) {
    const li = document.createElement("li");
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;

    const link = document.createElement("a");
    link.href = "#";
    link.className = "tree-item";
    link.setAttribute("role", "button");
    link.setAttribute("aria-expanded", hasChildren ? "false" : "true");
    link.dataset.url = node.page || "";

    const caret = document.createElement("i");
    caret.className = "fa-solid fa-caret-right caret";
    if (!hasChildren) caret.style.visibility = "hidden";

    const icon = document.createElement("i");
    icon.className = hasChildren
      ? "fa-regular fa-folder text-warning"
      : "fa-regular fa-file-lines text-secondary";

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = node.title;

    link.append(caret, icon, label);
    li.appendChild(link);

    if (hasChildren) {
      const sub = makeUL(node.children);
      // IMPORTANT: start hidden
      sub.style.display = "none";
      li.appendChild(sub);

      link.addEventListener("click", (e) => {
        e.preventDefault();
        const expanded = link.getAttribute("aria-expanded") === "true";
        link.setAttribute("aria-expanded", String(!expanded));
        caret.classList.toggle("rotate");
        sub.style.display = expanded ? "none" : "block";
        li.classList.toggle("open", !expanded);  // CSS will show/hide via class too
      });
    } else if (node.page) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        loadPage(node.page);
      });
    }

    return li;
  }
}

// ---------- Mobile offcanvas tree ----------
function buildMobileTree(nodes, mount) {
  mount.innerHTML = "";
  mount.appendChild(buildAcc(nodes));

  function buildAcc(arr) {
    const ul = el("ul");
    arr.forEach(node => ul.appendChild(buildNode(node)));
    return ul;
  }

  function buildNode(node) {
    const li = el("li");
    const row = el("a", { href: "#", class: "tree-item", role: "button", "aria-expanded": "false" });
    const caret = el("i", { class: "fa-solid fa-caret-right caret" });
    const icon = el("i", { class: isLeaf(node) ? "fa-regular fa-file-lines text-secondary" : "fa-regular fa-folder text-primary" });
    const label = el("span", { class: "label" }, node.title);
    row.dataset.url = node.page || "";
    row.append(caret, icon, label);
    li.appendChild(row);

    if (node.children && node.children.length) {
      const sub = el("ul", { style: "display:none" });
      node.children.forEach(c => sub.appendChild(buildNode(c)));
      li.appendChild(sub);

      row.addEventListener("click", (e) => {
        e.preventDefault();
        const open = row.getAttribute("aria-expanded") === "true";
        row.setAttribute("aria-expanded", String(!open));
        caret.classList.toggle("rotate");
        sub.style.display = open ? "none" : "block";
      });
    } else if (node.page) {
      row.addEventListener("click", (e) => { e.preventDefault(); loadPage(node.page); });
      caret.style.visibility = "hidden";
    }
    return li;
  }
}

// ---------- Top navbar (multi-level dropdowns) ----------
function buildTopMenu(nodes, mount) {
  mount.innerHTML = "";
  nodes.forEach(node => mount.appendChild(buildTopItem(node)));

  function buildTopItem(node, depth = 0) {
    const li = el("li", { class: depth === 0 ? "nav-item dropdown" : "dropdown-submenu dropend" });

    if (node.children && node.children.length) {
      const a = el("a", {
        href: "#", class: depth === 0 ? "nav-link dropdown-toggle" : "dropdown-item dropdown-toggle",
        role: "button", dataset: { bsToggle: "dropdown" }
      }, node.title);
      const menu = el("ul", { class: "dropdown-menu" });
      node.children.forEach(child => menu.appendChild(buildTopItem(child, depth + 1)));
      li.append(a, menu);
    } else if (node.page) {
      const a = el("a", { href: "#", class: depth === 0 ? "nav-link" : "dropdown-item" }, node.title);
      a.addEventListener("click", (e) => { e.preventDefault(); loadPage(node.page); });
      li.appendChild(a);
    }
    return li;
  }

  // Enable click-on-parent for nested dropdowns on desktop
  mount.querySelectorAll(".dropdown-submenu > a").forEach(a => {
    a.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      const next = this.nextElementSibling;
      document.querySelectorAll(".dropdown-submenu .dropdown-menu.show").forEach(m => m.classList.remove("show"));
      next?.classList.toggle("show");
    });
  });

  // Close nested menus when parent closes
  document.querySelectorAll(".dropdown").forEach(dd => {
    dd.addEventListener("hide.bs.dropdown", () => {
      dd.querySelectorAll(".dropdown-menu.show").forEach(m => m.classList.remove("show"));
    });
  });
}


