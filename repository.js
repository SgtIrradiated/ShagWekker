(function repositoryPage() {
  const uploadForm = document.getElementById("uploadForm");
  const fileInput = document.getElementById("fileInput");
  const uploadStatus = document.getElementById("uploadStatus");
  const fileList = document.getElementById("fileList");
  const fileEmptyState = document.getElementById("fileEmptyState");
  const uploadDropzone = document.getElementById("uploadDropzone");
  const refreshButton = document.getElementById("refreshButton");
  const repositoryStatus = document.getElementById("repositoryStatus");

  if (!uploadForm || !fileInput || !uploadStatus || !fileList || !fileEmptyState || !uploadDropzone) {
    return;
  }

  const setStatus = (message, tone = "info") => {
    uploadStatus.textContent = message;
    uploadStatus.dataset.tone = tone;
    uploadStatus.hidden = !message;
  };

  const toggleUploading = state => {
    uploadForm.classList.toggle("is-uploading", Boolean(state));
    if (state) {
      setStatus("Bestanden uploaden...", "info");
    }
  };

  const formatBytes = bytes => {
    if (!Number.isFinite(bytes)) return "0 B";
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  };

  const formatTimestamp = iso => {
    if (!iso) return "Onbekend";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return "Onbekend";
    }
    return date.toLocaleString("nl-NL", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  };

  const iconForExtension = name => {
    const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    switch (ext) {
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
      case "webp":
        return "🖼️";
      case "pdf":
        return "📕";
      case "zip":
      case "rar":
      case "7z":
        return "🗜️";
      case "mp4":
      case "mov":
      case "avi":
        return "🎞️";
      case "mp3":
      case "wav":
      case "ogg":
        return "🎧";
      case "doc":
      case "docx":
      case "txt":
      case "md":
        return "📄";
      case "xls":
      case "xlsx":
      case "csv":
        return "📊";
      case "ppt":
      case "pptx":
        return "🖥️";
      default:
        return "📁";
    }
  };

  const badgeForExtension = name => {
    const ext = name.includes(".") ? name.split(".").pop().toUpperCase() : "FILE";
    return ext || "FILE";
  };

  const renderFiles = files => {
    fileList.innerHTML = "";
    const list = Array.isArray(files) ? files : [];

    if (!list.length) {
      fileEmptyState.hidden = false;
      return;
    }

    fileEmptyState.hidden = true;

    list.forEach(file => {
      const card = document.createElement("article");
      card.className = "file-card";
      card.setAttribute("role", "listitem");
      card.dataset.ext = badgeForExtension(file.name);

      const icon = document.createElement("div");
      icon.className = "file-card__icon";
      icon.textContent = iconForExtension(file.name);
      icon.setAttribute("aria-hidden", "true");

      const body = document.createElement("div");
      body.className = "file-card__body";

      const nameEl = document.createElement("p");
      nameEl.className = "file-card__name";
      nameEl.textContent = file.name;

      const metaEl = document.createElement("p");
      metaEl.className = "file-card__meta";
      metaEl.textContent = `${formatBytes(file.size)} • ${formatTimestamp(file.modified)}`;

      const badge = document.createElement("span");
      badge.className = "file-card__badge";
      badge.textContent = badgeForExtension(file.name);

      const download = document.createElement("a");
      download.className = "btn outline file-card__download";
      download.href = file.url;
      download.download = file.name;
      download.textContent = "Download";

      body.appendChild(nameEl);
      body.appendChild(metaEl);

      card.appendChild(icon);
      card.appendChild(body);
      card.appendChild(badge);
      card.appendChild(download);

      fileList.appendChild(card);
    });
  };

  const updateRepositoryStatus = () => {
    if (!repositoryStatus) return;
    const now = new Date();
    repositoryStatus.textContent = `Bijgewerkt ${now.toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  };

  const loadFiles = async () => {
    try {
      fileList.classList.add("is-loading");
      setStatus("Bestanden laden...", "info");
      const response = await fetch("/api/files", { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`Kon bestanden niet laden: ${response.status}`);
      }
      const payload = await response.json();
      const files = Array.isArray(payload.files) ? payload.files : payload;
      renderFiles(files);
      if (files.length) {
        setStatus(`${files.length} bestand${files.length === 1 ? "" : "en"} klaar om te downloaden.`, "success");
      } else {
        setStatus("Nog geen bestanden geüpload.", "warning");
      }
      updateRepositoryStatus();
    } catch (error) {
      console.error(error);
      setStatus("Bestanden konden niet worden geladen.", "error");
    } finally {
      fileList.classList.remove("is-loading");
    }
  };

  const uploadFiles = async files => {
    const fileArray = Array.from(files || []).filter(Boolean);
    if (!fileArray.length) {
      setStatus("Selecteer minimaal één bestand om te uploaden.", "warning");
      return;
    }

    const formData = new FormData();
    fileArray.forEach(file => formData.append("files", file));

    try {
      toggleUploading(true);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Upload mislukt");
      }

      const result = await response.json();
      const uploadedCount = Array.isArray(result.files) ? result.files.length : fileArray.length;
      setStatus(`${uploadedCount} bestand${uploadedCount === 1 ? "" : "en"} succesvol geüpload.`, "success");
      uploadForm.reset();
      await loadFiles();
    } catch (error) {
      console.error(error);
      setStatus("Uploaden is mislukt. Probeer het opnieuw.", "error");
    } finally {
      toggleUploading(false);
    }
  };

  uploadForm.addEventListener("submit", event => {
    event.preventDefault();
    uploadFiles(fileInput.files);
  });

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      loadFiles();
    });
  }

  const handleDrop = files => {
    uploadDropzone.classList.remove("is-active");
    uploadFiles(files);
  };

  uploadDropzone.addEventListener("click", () => {
    fileInput.click();
  });

  uploadDropzone.addEventListener("keydown", event => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      fileInput.click();
    }
  });

  uploadDropzone.addEventListener("dragenter", event => {
    event.preventDefault();
    uploadDropzone.classList.add("is-active");
  });

  uploadDropzone.addEventListener("dragover", event => {
    event.preventDefault();
    uploadDropzone.classList.add("is-active");
  });

  ["dragleave", "dragend"].forEach(type => {
    uploadDropzone.addEventListener(type, () => {
      uploadDropzone.classList.remove("is-active");
    });
  });

  uploadDropzone.addEventListener("drop", event => {
    event.preventDefault();
    const { files } = event.dataTransfer || {};
    if (files) {
      handleDrop(files);
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) {
      setStatus(`${fileInput.files.length} bestand${fileInput.files.length === 1 ? "" : "en"} geselecteerd.`, "info");
    } else {
      setStatus("");
    }
  });

  loadFiles();
})();
