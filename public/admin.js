"use strict";

const $ = (selector) => document.querySelector(selector);

let adminToken = "";
let books = [];

const fields = [
  "title",
  "subtitle",
  "author",
  "series",
  "seriesOrder",
  "genre",
  "publicationStatus",
  "publicationDate",
  "bookPages",
  "isbn",
  "bookFormat",
  "coverUrl",
  "amazonLink",
  "purchaseLink",
  "googlePlayBooksLink",
  "signedContactEmail",
  "signedHardcoverPrice",
  "signedPaperbackPrice",
  "description",
  "fullDescription",
  "signedCopyInstructions",
  "featuredBook",
  "hardcoverAvailable",
  "paperbackAvailable",
  "eBookAvailable",
  "audiobookAvailable",
  "signedCopyAvailable"
];

const bools = new Set([
  "featuredBook",
  "hardcoverAvailable",
  "paperbackAvailable",
  "eBookAvailable",
  "audiobookAvailable",
  "signedCopyAvailable"
]);

function setStatus(text, connected = false) {
  const element = $("#connection-status");

  if (element) {
    element.textContent = text;
    element.classList.toggle("connected", connected);
  }
}

function message(text) {
  const element = $("#admin-message");

  if (element) {
    element.textContent = text;
  }
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

async function api(path, options = {}) {
  const headers = {
    Authorization: `Bearer ${adminToken}`,
    ...(options.body
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers || {})
  };

  const response = await fetch(path, {
    ...options,
    headers
  });

  const responseText = await response.text();
  let data = {};

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { message: responseText };
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      `Request failed (${response.status})`
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
    const check = await api("/api/admin/check");

    if (!check.authorized) {
      throw new Error(
        check.configured
          ? "The token was rejected. Check that it matches your Cloudflare ADMIN_TOKEN."
          : "The Cloudflare ADMIN_TOKEN secret is not configured."
      );
    }

    await refresh();

    sessionStorage.setItem("resmith_admin_token", adminToken);

    $("#login-panel").hidden = true;
    $("#dashboard").hidden = false;

    setStatus("Connected", true);
    message(`${books.length} books loaded.`);
  } catch (error) {
    adminToken = "";
    sessionStorage.removeItem("resmith_admin_token");

    setStatus("Not connected");

    $("#login-error").textContent =
      "Could not connect: " + error.message;
  }
}

async function refresh() {
  const data = await api("/api/books");

  books = Array.isArray(data)
    ? data
    : (data.books || data.results || []);

  renderBooks();
}

function renderBooks() {
  const searchElement = $("#admin-search");
  const query = (searchElement?.value || "").trim().toLowerCase();

  const filtered = books.filter(book =>
    [
      book.title,
      book.series,
      book.genre,
      book.publicationStatus,
      book.isbn
    ]
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
        <button type="button"
          data-edit="${escapeHtml(book.id)}">Edit</button>
        <button type="button"
          data-delete="${escapeHtml(book.id)}">Delete</button>
      </td>
    </tr>
  `).join("");

  $("#admin-book-rows")
    .querySelectorAll("[data-edit]")
    .forEach(button => {
      button.addEventListener("click", () => {
        const book = books.find(item =>
          String(item.id) === button.dataset.edit
        );

        if (book) showForm(book);
      });
    });

  $("#admin-book-rows")
    .querySelectorAll("[data-delete]")
    .forEach(button => {
      button.addEventListener("click", () => {
        deleteBook(button.dataset.delete);
      });
    });

  message(`Showing ${filtered.length} of ${books.length} books.`);
}

function showForm(book = null) {
  $("#book-form").hidden = false;

  $("#form-heading").textContent =
    book ? "Edit a book" : "Add a book";

  $("#book-form").reset();
  $("#f-id").value = book?.id || "";

  for (const key of fields) {
    const element = $("#f-" + key);

    if (!element) continue;

    if (bools.has(key)) {
      element.checked = Boolean(book?.[key]);
    } else {
      element.value = book?.[key] ?? "";
    }
  }

  $("#book-form").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function saveBook(event) {
  event.preventDefault();

  const id = $("#f-id").value.trim();

  const existing = id
    ? books.find(book => String(book.id) === id)
    : null;

  // Preserve database fields that are not displayed in the form.
  const book = existing ? { ...existing } : {};

  for (const key of fields) {
    const element = $("#f-" + key);

    if (!element) continue;

    book[key] = bools.has(key)
      ? element.checked
      : element.value.trim();
  }

  if (!book.title) {
    alert("Please enter a book title.");
    return;
  }

  const saveButton = $("#book-form button[type='submit']");
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";

  try {
    if (id) {
      await api(
        `/api/admin/books/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          body: JSON.stringify(book)
        }
      );
    } else {
      await api("/api/admin/books", {
        method: "POST",
        body: JSON.stringify(book)
      });
    }

    await refresh();

    $("#book-form").hidden = true;

    message(id ? "Book updated successfully." : "Book added successfully.");
  } catch (error) {
    alert("Could not save the book:\n" + error.message);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save book";
  }
}

async function deleteBook(id) {
  const book = books.find(item => String(item.id) === String(id));

  if (!book) {
    alert("That book could not be found.");
    return;
  }

  const confirmed = confirm(
    `Delete "${book.title}" from the catalog?\n\nThis permanently removes that book record.`
  );

  if (!confirmed) return;

  try {
    await api(
      `/api/admin/books/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );

    await refresh();
    message(`Deleted "${book.title}".`);
  } catch (error) {
    alert("Could not delete the book:\n" + error.message);
  }
}

function csvEscape(value) {
  const text = String(value ?? "");

  return /[",\r\n]/.test(text)
    ? '"' + text.replace(/"/g, '""') + '"'
    : text;
}

function exportCsv() {
  const columns = [
    "id",
    ...fields,
    "directOrderInstructions",
    "signedCopyContactEmail",
    "slug"
  ];

  const uniqueColumns = [...new Set(columns)];

  const rows = [
    uniqueColumns.map(csvEscape).join(","),
    ...books.map(book =>
      uniqueColumns
        .map(key => csvEscape(
          bools.has(key) ? Boolean(book[key]) : book[key]
        ))
        .join(",")
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
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;

      row.push(value);
      value = "";

      if (row.some(cell => cell.trim() !== "")) {
        rows.push(row);
      }

      row = [];
    } else {
      value += char;
    }
  }

  row.push(value);

  if (row.some(cell => cell.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

async function importCsv(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  try {
    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length < 2) {
      throw new Error("The CSV file contains no book records.");
    }

    const headers = rows[0].map(value => value.trim().replace(/^\uFEFF/, ""));

    if (!headers.includes("title")) {
      throw new Error('The CSV must contain a "title" column.');
    }

    const imported = rows.slice(1).map(row => {
      const book = {};

      headers.forEach((header, index) => {
        if (header) book[header] = row[index] ?? "";
      });

      for (const key of bools) {
        if (key in book) {
          book[key] = (
            book[key] === true ||
            ["true", "1", "yes", "y"].includes(
              String(book[key]).trim().toLowerCase()
            )
          );
        }
      }

      return book;
    }).filter(book => String(book.title || "").trim());

    if (!imported.length) {
      throw new Error("No rows with book titles were found.");
    }

    const confirmed = confirm(
      `Found ${imported.length} books in this CSV.\n\n` +
      "Matching IDs can update existing records. Records without matching IDs may be added as new books.\n\n" +
      "Continue with import?"
    );

    if (!confirmed) return;

    const result = await api("/api/admin/books", {
      method: "POST",
      body: JSON.stringify({ books: imported })
    });

    await refresh();

    alert(
      `Import finished. The server saved ${result.saved ?? "the submitted"} records.`
    );
  } catch (error) {
    alert("CSV import failed:\n" + error.message);
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
  message("");
}

function initializeDashboard() {
  $("#login-form").addEventListener("submit", event => {
    event.preventDefault();
    connectDashboard();
  });

  $("#book-form").addEventListener("submit", saveBook);

  $("#new-book").addEventListener("click", () => showForm());

  $("#cancel-form").addEventListener("click", () => {
    $("#book-form").hidden = true;
  });

  $("#cancel-form-bottom").addEventListener("click", () => {
    $("#book-form").hidden = true;
  });

  $("#admin-search").addEventListener("input", renderBooks);

  $("#export-csv").addEventListener("click", exportCsv);

  $("#csv-import").addEventListener("change", importCsv);

  $("#logout").addEventListener("click", signOut);

  const savedToken = sessionStorage.getItem("resmith_admin_token");

  if (savedToken) {
    $("#admin-token").value = savedToken;
  }
}

document.addEventListener("DOMContentLoaded", initializeDashboard);
