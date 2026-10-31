
$("#book-form").addEventListener("submit", async e => {
  e.preventDefault();

  const existing = $("#f-id").value
    ? books.find(b => String(b.id) === String($("#f-id").value))
    : null;

  // Preserve fields that are not represented in the HTML form.
  const b = existing ? { ...existing } : {};

  for (const k of fields) {
    const el = $("#f-" + k);
    if (!el) continue;

    b[k] = bools.has(k) ? el.checked : el.value.trim();
  }

  if (!b.id) b.id = crypto.randomUUID();

  if (!b.slug) {
    b.slug = b.title.toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  try {
    await api("/api/admin/books/" + encodeURIComponent(b.id), {
      method: "PUT",
      body: JSON.stringify(b)
    });

    await refresh();
    hideForm();
    $("#admin-message").textContent = "Book saved successfully.";
  } catch (err) {
    alert("Could not save book: " + err.message);
  }
});
```
