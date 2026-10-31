const $ = (selector) => document.querySelector(selector);

const fields = [
  "id", "title", "subtitle", "author", "series", "seriesOrder",
  "description", "fullDescription", "bookPages", "genre",
  "publicationStatus", "publicationDate", "isbn", "bookFormat",
  "purchaseLink", "amazonLink", "googlePlayBooksLink", "featuredBook",
  "hardcoverAvailable", "paperbackAvailable", "eBookAvailable",
  "audiobookAvailable", "signedCopyAvailable", "signedHardcoverPrice",
  "signedPaperbackPrice", "directOrderInstructions",
  "signedCopyContactEmail", "signedCopyInstructions",
  "signedContactEmail", "slug", "coverUrl"
];

const bools = new Set([
  "featuredBook",
  "hardcoverAvailable",
  "paperbackAvailable",
  "eBookAvailable",
  "audiobookAvailable",
  "signedCopyAvailable"
]);

let adminToken = "";
let books = [];

function setStatus(text) {
  $("#connection-status").textContent = text;
}

function message(text) {
  $("#admin-message").textContent = text;
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(adminToken
      ? { Authorization: `Bearer ${adminToken}` }
      : {}),
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
    throw new Error("The server returned an unreadable response.");
  }

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed (${response.status}).`
    );
  }

  return data;
}

async function connectDashboard(event) {
  if (event) event.preventDefault();

  const token = $("#admin-token").value.trim();

  if (!token) {
    $("#login-error").textContent = "Enter your admin token.";
    return;
  }

  adminToken = token;
  $("#login-error").textContent = "";
  setStatus("Connecting...");

  try {
    const result = await api("/api/admin/check");

    if (!result.configured) {
      throw new Error("The ADMIN_TOKEN secret is not configured.");
    }

    if (!result.authorized) {
      throw new Error("The admin token was not accepted.");
    }

    sessionStorage.setItem("resmith_admin_token", token);

    await refresh();

    $("#login-panel").hidden = true;
    $("#dashboard").hidden = false;
    setStatus("Connected");
  } catch (error) {
    adminToken = "";
    $("#login-error").textContent = error.message;
    setStatus("Not connected");
  }
}

async function refresh() {
  const data = await api("/api/books");
  books = Array.isArray(data.books) ? data.books : [];
  renderBooks();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function renderBooks() {
  const query = $("#admin-search").value.trim().toLowerCase();

  const filtered = books.filter((book) => {
    const text = [
      book.title,
      book.series,
      book.genre,
      book.publicationStatus,
      book.isbn
    ].join(" ").toLowerCase();

    return text.includes(query);
  });

  $("#admin-book-rows").innerHTML = filtered.map((book) => `
    <tr>
      <td>${escapeHtml(book.title)}</td>
      <td>${escapeHtml(book.series)}</td>
      <td>${escapeHtml(book.genre)}</td>
      <td>${escapeHtml(book.publicationStatus)}</td>
      <td>${book.featuredBook ? "Yes" : "No"}</td>
      <td>
        <button
          type="button"
          class="button button-outline"
          data-edit-id="${escapeHtml(book.id)}"
        >Edit</button>
      </td>
    </tr>
  `).join("");

  $("#admin-book-rows").querySelectorAll("[data-edit-id]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const book = books.find(
          (item) => String(item.id) === button.dataset.editId
        );

        if (book) showForm(book);
      });
    });

  message(`Showing ${filtered.length} of ${books.length} books.`);
}

function showForm(book = null) {
  const form = $("#book-form");
  form.reset();

  const isEditing = Boolean(book);

  $("#form-heading").textContent = isEditing
    ? "Edit book"
    : "Add a book";

  // Keep every existing field, including fields that are not
  // displayed in the form. This is essential when editing.
  const values = book ? { ...book } : {
    author: "R. E. Smith",
    publicationStatus: "",
    featuredBook: false,
    hardcoverAvailable: false,
    paperbackAvailable: false,
    eBookAvailable: false,
    audiobookAvailable: false,
    signedCopyAvailable: false
  };

  for (const key of fields) {
    const element = $(`#f-${key}`);
    if (!element) continue;

    if (bools.has(key)) {
      element.checked = Boolean(values[key]);
    } else {
      element.value = values[key] ?? "";
    }
  }

  // Support existing status values such as "Available" even if
  // that value was not originally listed in the dropdown.
  const status = $("#f-publicationStatus");
  const currentStatus = values.publicationStatus ?? "";

  if (
    currentStatus &&
    !Array.from(status.options).some(
      (option) => option.value === currentStatus
    )
  ) {
    const option = document.createElement("option");
    option.value = currentStatus;
    option.textContent = currentStatus;
    status.appendChild(option);
  }

  status.value = currentStatus;

  form.hidden = false;

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function hideForm() {
  $("#book-form").hidden = true;
}

async function saveBook(event) {
  event.preventDefault();

  const id = $("#f-id").value.trim();

  // Find the original record before changing any form values.
  const existing = id
    ? books.find((book) => String(book.id) === id)
    : null;

  if (id && !existing) {
    alert(
      "The original book record could not be found. " +
      "Nothing was saved. Refresh the dashboard and try again."
    );
    return;
  }

  // Start with the complete original record, preserving fields
  // that do not have an input on the form.
  const book = existing ? { ...existing } : {};

  // Read only fields actually represented in the HTML form.
  for (const key of fields) {
    const element = $(`#f-${key}`);
    if (!element) continue;

    book[key] = bools.has(key)
      ? element.checked
      : element.value.trim();
  }

  if (!book.id) {
    book.id = crypto.randomUUID();
  }

  if (!book.author) {
    book.author = "R. E. Smith";
  }

  if (!book.title) {
    alert("Please enter a book title.");
    return;
  }

  if (!book.slug) {
    book.slug = book.title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  try {
    await api(
      "/api/admin/books/" + encodeURIComponent(book.id),
      {
        method: "PUT",
        body: JSON.stringify(book)
      }
    );

    await refresh();
    hideForm();
    message("Book saved successfully.");
  } catch (error) {
    alert("Could not save the book: " + error.message);
  }
}

function exportCsv() {
  const columns = fields;

  function csvCell(value) {
    if (typeof value === "boolean") {
      value = value ? "true" : "false";
    }

    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  const rows = [
    columns.map(csvCell).join(","),
    ...books.map((book) =>
      columns.map((column) => csvCell(book[column])).join(",")
    )
  ];

  const blob = new Blob(
    ["\uFEFF" + rows.join("\r\n")],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "resmith-books-backup.csv";
  link.click();

  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);

  if (row.some((value) => value !== "")) {
    rows.push(row);
  }

  if (rows.length < 2) {
    throw new Error("The CSV file has no book records.");
  }

  const headers = rows.shift().map((header) => header.trim());

  return rows
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values) => {
      const record = {};

      headers.forEach((header, index) => {
        if (fields.includes(header)) {
          const value = values[index] ?? "";

          record[header] = bools.has(header)
            ? value.toLowerCase() === "true" || value === "1"
            : value;
        }
      });

      return record;
    });
}

async function importCsv(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Import can change records. Require an explicit confirmation.
  if (!confirm(
    "CSV import can add or update book records. " +
    "Make sure you have exported a backup first. Continue?"
  )) {
    event.target.value = "";
    return;
  }

  try {
    const records = parseCsv(await file.text());

    if (!confirm(
      `The file contains ${records.length} rows. ` +
      "Proceed with the import?"
    )) {
      return;
    }

    await api("/api/admin/books", {
      method: "POST",
      body: JSON.stringify({ books: records })
    });

    await refresh();
    message(`Imported ${records.length} CSV rows.`);
  } catch (error) {
    alert("CSV import failed: " + error.message);
  } finally {
    event.target.value = "";
  }
}

function signOut() {
  adminToken = "";
  sessionStorage.removeItem("resmith_admin_token");

  $("#dashboard").hidden = true;
  $("#login-panel").hidden = false;
  $("#admin-token").value = "";

  setStatus("Not connected");
  $("#login-error").textContent = "";
}

document.addEventListener("DOMContentLoaded", () => {
  $("#login-form").addEventListener("submit", connectDashboard);

  $("#admin-search").addEventListener("input", renderBooks);

  $("#new-book").addEventListener("click", () => showForm());

  $("#cancel-form").addEventListener("click", hideForm);
  $("#cancel-form-bottom").addEventListener("click", hideForm);

  $("#book-form").addEventListener("submit", saveBook);

  $("#export-csv").addEventListener("click", exportCsv);
  $("#csv-import").addEventListener("change", importCsv);

  $("#logout").addEventListener("click", signOut);

  const savedToken = sessionStorage.getItem("resmith_admin_token");

  if (savedToken) {
    $("#admin-token").value = savedToken;
  }
});
