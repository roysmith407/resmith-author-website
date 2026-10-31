const $ = (selector) => document.querySelector(selector);

let adminToken = "";
let books = [];

const fields = [
  "title", "subtitle", "author", "series", "seriesOrder",
  "genre", "publicationStatus", "publicationDate", "bookPages",
  "isbn", "bookFormat", "coverUrl", "amazonLink", "purchaseLink",
  "googlePlayBooksLink", "signedContactEmail", "signedHardcoverPrice",
  "signedPaperbackPrice", "description", "fullDescription",
  "signedCopyInstructions", "featuredBook", "hardcoverAvailable",
  "paperbackAvailable", "eBookAvailable", "audiobookAvailable",
  "signedCopyAvailable"
];

const bools = new Set([
  "featuredBook", "hardcoverAvailable", "paperbackAvailable",
  "eBookAvailable", "audiobookAvailable", "signedCopyAvailable"
]);

function setStatus(message, connected = false) {
  const el = $("#connection-status");
  if (el) {
    el.textContent = message;
    el.classList.toggle("connected", connected);
  }
}

function message(text) {
  const el = $("#admin-message");
  if (el) el.textContent = text;
}

async function api(path, options = {}) {
  const headers = {
    "Authorization": `Bearer ${adminToken}`,
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(path, {
    ...options,
    headers
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `Request failed (${response.status})`
    );
  }

  return data;
}

async function connectDashboard() {
  const tokenInput = $("#admin-token");
  const token = tokenInput.value.trim();

  if (!token) {
    $("#login-error").textContent = "Enter your admin token.";
    return;
  }

  adminToken = token;
  $("#login-error").textContent = "";
  setStatus("Connecting…");

  try {
    await api("/api/admin/check");
    await refresh();

    sessionStorage.setItem("resmith_admin_token", adminToken);
    $("#login-panel").hidden = true;
    $("#dashboard").hidden = false;
    setStatus("Connected", true);
    message(`${books.length} books loaded.`);
  } catch (error) {
    adminToken = "";
    setStatus("Not connected");
    $("#login-error").textContent =
      "Could not connect: " + error.message;
  }
}

async function refresh() {
  const data = await api("/api/books");
  books = Array.isArray(data) ? data : (data.books || data.results || []);
  renderBooks();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function renderBooks() {
  const query = ($("#admin-search").value || "").trim().toLowerCase();

  const filtered = books.filter(book =>
    [book.title, book.series, book.genre, book.publicationStatus]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );

  $("#admin-book-rows").innerHTML = filtered.map(book => `
    <tr>
      <td>${escapeHtml(book.title)}</td>
      <td>${escapeHtml(book.series)}</td>
      <td>${escapeHtml(book.genre)}</td>
      <td>${escapeHtml(book.publicationStatus)}</td>
      <td>${book.featuredBook ? "Yes" : "No"}</td>
      <td>
        <button type="button" data-edit="${escapeHtml(book.id)}">Edit</button>
        <button type="button" data-delete="${escapeHtml(book.id)}">Delete</button>
      </td>
    </tr>
  `).join("");

  $("#admin-book-rows").querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const book = books.find(item =>
        String(item.id) === button.dataset.edit
      );
      if (book) showForm(book);
    });
  });

  $("#admin-book-rows").querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => deleteBook(button.dataset.delete));
  });

  message(`Showing ${filtered.length} of ${books.length} books.`);
}

function showForm(book = null) {
  $("#book-form").hidden = false;
  $("#form-heading").textContent = book ? "Edit a book" : "Add a book";

  $("#book-form").reset();
  $("#f-id").value = book?.id || "";

  for (const key of fields) {
    const element = $("#f-" + key);
    if (!element) continue;

    if (bools.has(key)) {
      element.checked = Boolean(book?.[key]);
    } else
