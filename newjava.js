let liveFilter = "none";

// Access Base UI Panel Containers
const video = document.getElementById("webcam");
const startButton = document.getElementById("start-btn");

const viewHome = document.getElementById("view-home");
const viewLayout = document.getElementById("view-layout");
const viewCamera = document.getElementById("view-camera");
const viewDecor = document.getElementById("view-decor");
const viewFinal = document.getElementById("view-final");

// Camera Module Elements
const boothCamStream = document.getElementById("booth-cam-stream");
const countdownOverlay = document.getElementById("countdown-overlay");
const previewGrid = document.getElementById("photo-preview-grid");
const retakeBtn = document.getElementById("retake-btn");
const continueBtn = document.getElementById("continue-btn");

// Decoration Suite Elements
const decorCanvas = document.getElementById("decor-strip-canvas");
const decorCtx = decorCanvas.getContext("2d");
const decorColorWheel = document.getElementById("decor-color-wheel");
const masterSubmitBtn = document.getElementById("decor-master-submit-btn");

// Final Screen Elements
const finalStripCanvas = document.getElementById("final-strip-canvas");
const finalCountdownSpan = document.getElementById("final-countdown");
const printBtn = document.getElementById("print-btn");
const homeBtn = document.getElementById("home-btn");
const qrCodeDiv = document.getElementById("qr-code");

// Global Configuration States
let chosenSlots = 4;
let capturedPhotosList = []; // Stores the raw, unfiltered canvas snapshots securely
let countdownTimerInterval = null;

// Final Screen Timer Configuration States
let finalTimerInterval = null;
let secondsRemaining = 30;

const STRIP_W = 600;
const STRIP_H = 1800;
const STRIP_PADDING_X = 40;

let stripBackgroundColor = "#EB9AB2";
let activePlacedStickers = [];
let selectedStickerRef = null;
let stickerDragOffset = { x: 0, y: 0 };

// Global reference variable for the dynamic QRCode object
let qrCodeGeneratorInstance = null;

const iclLogoImage = new Image();
iclLogoImage.src = "assets/icl logo.png";

iclLogoImage.onload = () => {
  if (!viewDecor.classList.contains("hidden")) {
    renderPhotoStripCanvas();
  }
};

// Global tracking state for the custom template selection
let activeTemplateTheme = "default";

const stripDesigns = {
  default: null,
  polkadot: new Image(),
};

// FIXED PATH: Points exactly to your new polkadots asset file
stripDesigns.polkadot.src = "assets2/Strips/polka dot-frame.png";

// Auto-rerender if the overlay design finishes loading
stripDesigns.polkadot.onload = () => {
  console.log("Polkadot design template loaded successfully!");
  if (!viewDecor.classList.contains("hidden")) {
    renderPhotoStripCanvas();
  }
};

// Error handling to help you debug in your browser console if the path is broken
stripDesigns.polkadot.onerror = () => {
  console.error(
    "Could not find the template file at: " +
      stripDesigns.polkadot.src +
      ". Double check your spelling and file extensions inside the assets folder!",
  );
};

const gettysburgQRImage = new Image();
gettysburgQRImage.src =
  "https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=" +
  encodeURIComponent("https://icl.sites.gettysburg.edu/");

gettysburgQRImage.onload = () => {
  if (!viewDecor.classList.contains("hidden")) {
    renderPhotoStripCanvas();
  }
};

function startCamera(videoTarget) {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then(function (stream) {
        videoTarget.srcObject = stream;
      })
      .catch(function (error) {
        console.error("Webcam matrix configuration streaming failed: ", error);
      });
  }
}

// Home screen event navigation- automatic kiosk mode
startButton.addEventListener("click", () => {
  const element = document.documentElement;

  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }

  viewHome.classList.add("hidden");
  viewLayout.classList.remove("hidden");
});

// Layout grid event navigation maps to individual slot counts
document.querySelectorAll(".layout-card").forEach((card) => {
  const selectButton = card.querySelector(".cut-btn");
  if (selectButton) {
    selectButton.addEventListener("click", () => {
      chosenSlots = parseInt(card.getAttribute("data-slots"));

      viewLayout.classList.add("hidden");
      viewCamera.classList.remove("hidden");

      startCamera(boothCamStream);
      initializePhotoboothSession();
    });
  }
});

// Map HTML data-filter keys to precise, Safari-safe canvas filter configurations
function getCanvasFilterString(filterName) {
  switch (filterName) {
    case "traditional":
      return "grayscale(100%) contrast(120%) brightness(103%)";
    case "sepia":
      return "sepia(75%) saturate(115%) contrast(105%)";
    case "soft":
      return "brightness(114%) contrast(92%) saturate(108%)";
    case "y2k":
      return "contrast(120%) brightness(108%) saturate(50%) hue-rotate(-8deg)";
    case "vivid":
      return "contrast(112%) saturate(170%) brightness(104%)";
    case "none":
    default:
      return "none";
  }
}

function initializePhotoboothSession() {
  capturedPhotosList = [];
  previewGrid.innerHTML = "";
  retakeBtn.classList.add("hidden");
  continueBtn.classList.add("hidden");

  if (chosenSlots === 2) {
    previewGrid.style.gridTemplateColumns = "1fr";
    previewGrid.style.maxWidth = "240px";
  } else {
    previewGrid.style.gridTemplateColumns = "repeat(2, 1fr)";
    previewGrid.style.maxWidth = "100%";
  }

  for (let i = 0; i < chosenSlots; i++) {
    const slotBox = document.createElement("div");
    slotBox.className = "preview-box-slot";
    slotBox.id = `capture-preview-${i}`;
    previewGrid.appendChild(slotBox);
  }

  triggerNextPhotoSequence();
}

function triggerNextPhotoSequence() {
  let timeLeft = 3;
  countdownOverlay.innerText = timeLeft;
  countdownOverlay.classList.remove("hidden");

  countdownTimerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      countdownOverlay.innerText = timeLeft;
    } else {
      clearInterval(countdownTimerInterval);
      countdownOverlay.classList.add("hidden");

      snapFramePhoto();

      if (capturedPhotosList.length < chosenSlots) {
        setTimeout(triggerNextPhotoSequence, 1200);
      } else {
        retakeBtn.classList.remove("hidden");
        continueBtn.classList.remove("hidden");
      }
    }
  }, 1000);
}

function snapFramePhoto() {
  const targetIndex = capturedPhotosList.length;

  const rawCanvas = document.createElement("canvas");
  rawCanvas.width = 640;
  rawCanvas.height = 480;
  const rawCtx = rawCanvas.getContext("2d");
  rawCtx.drawImage(boothCamStream, 0, 0, rawCanvas.width, rawCanvas.height);

  capturedPhotosList.push(rawCanvas);

  const currentFrameSlot = document.getElementById(
    `capture-preview-${targetIndex}`,
  );
  if (currentFrameSlot) {
    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = 640;
    previewCanvas.height = 480;
    currentFrameSlot.appendChild(previewCanvas);

    const ctx = previewCanvas.getContext("2d");
    ctx.drawImage(rawCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
  }
}

retakeBtn.addEventListener("click", () => {
  clearInterval(countdownTimerInterval);
  initializePhotoboothSession();
});

window.addEventListener("DOMContentLoaded", () => {
  startCamera(video);
});

if (continueBtn) {
  continueBtn.addEventListener("click", () => {
    viewCamera.classList.add("hidden");
    viewDecor.classList.remove("hidden");
    renderPhotoStripCanvas();
  });
}

function renderPhotoStripCanvas() {
  decorCanvas.width = STRIP_W;
  decorCanvas.height = STRIP_H;

  // 1. FILL BASE BACKGROUND COLOR (Draws background color underneath the pictures)
  decorCtx.fillStyle = stripBackgroundColor;
  decorCtx.fillRect(0, 0, STRIP_W, STRIP_H);

  const slotCount = capturedPhotosList.length;
  const photoW = STRIP_W - STRIP_PADDING_X * 2;

  let photoH = photoW * 0.75;
  let topOffsetMargin = 24;
  let gapSpacingValue = 16;

  // Adjust placement dimensions matching total images selected
  if (slotCount === 2) {
    photoH = photoW * 0.75;
    topOffsetMargin = 180;
    gapSpacingValue = 60;
  } else if (slotCount === 3) {
    photoH = photoW * 0.75;
    topOffsetMargin = 100;
    gapSpacingValue = 45;
  } else if (slotCount === 4) {
    photoH = photoW * 0.68;
    topOffsetMargin = 45;
    gapSpacingValue = 20;
  }

  // 2. DRAW USER PHOTOS LAYER
  for (let i = 0; i < slotCount; i++) {
    const targetY = topOffsetMargin + i * (photoH + gapSpacingValue);

    decorCtx.save();
    const x = STRIP_PADDING_X;
    const y = targetY;

    decorCtx.beginPath();
    decorCtx.rect(x, y, photoW, photoH);
    decorCtx.clip();

    decorCtx.filter = getCanvasFilterString(liveFilter);

    decorCtx.translate(x + photoW, y);
    decorCtx.scale(-1, 1);
    decorCtx.drawImage(capturedPhotosList[i], 0, 0, photoW, photoH);
    decorCtx.restore();
  }

  // 3. FULL-SIZE OVERLAY LAYER (Draws cleanly on top of photos to frame/mask them)
  if (activeTemplateTheme === "polkadot") {
    if (stripDesigns.polkadot.complete || stripDesigns.polkadot.width > 0) {
      decorCtx.drawImage(stripDesigns.polkadot, 0, 0, STRIP_W, STRIP_H);
    }
  }

  // 4. BRANDING & FOOTER ZONE HANDLERS
  const footerY = 1620;
  const logoSize = 110;
  const qrDisplaySize = 110;

  if (activeTemplateTheme === "default") {
    const logoX = STRIP_PADDING_X + 20;
    const qrX = STRIP_W - STRIP_PADDING_X - qrDisplaySize - 20;

    // Draw default branding only if a custom overlay isn't covering it
    if (iclLogoImage.complete || iclLogoImage.width > 0) {
      decorCtx.drawImage(iclLogoImage, logoX, footerY, logoSize, logoSize);
    }

    if (gettysburgQRImage.complete || gettysburgQRImage.width > 0) {
      decorCtx.drawImage(
        gettysburgQRImage,
        qrX,
        footerY,
        qrDisplaySize,
        qrDisplaySize,
      );
    }

    decorCtx.fillStyle = "#ffffff";
    decorCtx.font = "900 26px sans-serif";
    decorCtx.textAlign = "center";
    decorCtx.letterSpacing = "2px";
    decorCtx.fillText("GETTYSBURG COLLEGE", STRIP_W / 2, footerY - 40);
  } else if (activeTemplateTheme === "polkadot") {
    // Keep live QR stream aligned directly to the custom transparent footer window coordinates
    const customQrX = 468;
    const customQrY = 1664;

    if (gettysburgQRImage.complete || gettysburgQRImage.width > 0) {
      decorCtx.drawImage(
        gettysburgQRImage,
        customQrX,
        customQrY,
        104, // Perfectly scales to fit the polkadot strip window asset template
        104,
      );
    }
  }

  // 5. STICKERS LOOP LAYER (Handles Text and PNG Drag Elements on absolute top layer)
  decorCtx.save();
  if (activePlacedStickers && activePlacedStickers.length > 0) {
    activePlacedStickers.forEach((stk) => {
      if (stk === selectedStickerRef) {
        decorCtx.shadowColor = "rgba(255, 255, 255, 0.9)";
        decorCtx.shadowBlur = 12;
      } else {
        decorCtx.shadowBlur = 0;
      }

      if (stk.isText) {
        decorCtx.font = `${stk.size}px Arial`;
        decorCtx.textBaseline = "middle";
        decorCtx.textAlign = "center";
        decorCtx.fillText(stk.emoji, stk.x, stk.y);
      } else if (stk.imgObj && (stk.imgObj.complete || stk.imgObj.width > 0)) {
        decorCtx.drawImage(
          stk.imgObj,
          stk.x - stk.size / 2,
          stk.y - stk.size / 2,
          stk.size,
          stk.size,
        );
      }
    });
  }
  decorCtx.restore();
}

// Track circular button palette additions
document.querySelectorAll(".preset-color-circle-btn").forEach((box) => {
  box.addEventListener("click", () => {
    stripBackgroundColor = box.getAttribute("data-color");
    renderPhotoStripCanvas();
  });
});

if (decorColorWheel) {
  decorColorWheel.addEventListener("input", (e) => {
    stripBackgroundColor = e.target.value;
    renderPhotoStripCanvas();
  });
}

// Track template style selections
document.querySelectorAll(".strip-template-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".strip-template-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    activeTemplateTheme = btn.getAttribute("data-template");
    renderPhotoStripCanvas();
  });
});

document.querySelectorAll(".filter-action-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-action-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    liveFilter = btn.getAttribute("data-filter");
    renderPhotoStripCanvas();
  });
});

function getCanvasCoordinates(e) {
  const boundingBox = decorCanvas.getBoundingClientRect();
  return {
    x: ((e.clientX - boundingBox.left) / boundingBox.width) * decorCanvas.width,
    y:
      ((e.clientY - boundingBox.top) / boundingBox.height) * decorCanvas.height,
  };
}

// ============================================================================
// DRAG-AND-DROP & WHEEL RESIZING INTERACTION MATRIX (Hybrid Edition)
// ============================================================================

document.querySelectorAll(".draggable-emoji-source").forEach((emojiEl) => {
  emojiEl.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", emojiEl.getAttribute("data-img"));
  });

  emojiEl.addEventListener("click", () => {
    const targetAsset = emojiEl.getAttribute("data-img");
    if (!targetAsset) return;

    const newSticker = {
      id: Date.now() + Math.random(),
      x: STRIP_W / 2,
      y: STRIP_H / 2,
      size: 90,
    };

    if (targetAsset.includes("/")) {
      const stickerImg = new Image();
      stickerImg.src = targetAsset;
      stickerImg.onload = () => renderPhotoStripCanvas();
      newSticker.imgObj = stickerImg;
      newSticker.isText = false;
    } else {
      newSticker.emoji = targetAsset;
      newSticker.isText = true;
    }

    activePlacedStickers.push(newSticker);
    selectedStickerRef = newSticker;
    renderPhotoStripCanvas();
  });
});

decorCanvas.addEventListener("dragover", (e) => {
  e.preventDefault();
});

decorCanvas.addEventListener("drop", (e) => {
  e.preventDefault();
  const targetAsset = e.dataTransfer.getData("text/plain");
  if (!targetAsset) return;

  const mousePos = getCanvasCoordinates(e);
  const newSticker = {
    id: Date.now() + Math.random(),
    x: mousePos.x,
    y: mousePos.y,
    size: 90,
  };

  if (targetAsset.includes("/")) {
    const stickerImg = new Image();
    stickerImg.src = targetAsset;
    stickerImg.onload = () => renderPhotoStripCanvas();
    newSticker.imgObj = stickerImg;
    newSticker.isText = false;
  } else {
    newSticker.emoji = targetAsset;
    newSticker.isText = true;
  }

  activePlacedStickers.push(newSticker);
  selectedStickerRef = newSticker;
  renderPhotoStripCanvas();
});

decorCanvas.addEventListener("pointerdown", (e) => {
  const mousePos = getCanvasCoordinates(e);
  let clickedSticker = false;

  for (let i = activePlacedStickers.length - 1; i >= 0; i--) {
    const stk = activePlacedStickers[i];
    const dist = Math.sqrt(
      (mousePos.x - stk.x) ** 2 + (mousePos.y - stk.y) ** 2,
    );
    if (dist < stk.size / 1.2) {
      selectedStickerRef = stk;
      stickerDragOffset.x = mousePos.x - stk.x;
      stickerDragOffset.y = mousePos.y - stk.y;
      decorCanvas.setPointerCapture(e.pointerId);
      clickedSticker = true;
      break;
    }
  }

  if (!clickedSticker) {
    selectedStickerRef = null;
  }
  renderPhotoStripCanvas();
});

decorCanvas.addEventListener("pointermove", (e) => {
  if (!selectedStickerRef || !decorCanvas.hasPointerCapture(e.pointerId))
    return;
  const mousePos = getCanvasCoordinates(e);
  selectedStickerRef.x = mousePos.x - stickerDragOffset.x;
  selectedStickerRef.y = mousePos.y - stickerDragOffset.y;
  renderPhotoStripCanvas();
});

decorCanvas.addEventListener("pointerup", (e) => {
  if (selectedStickerRef) {
    decorCanvas.releasePointerCapture(e.pointerId);
  }
});

decorCanvas.addEventListener(
  "wheel",
  (e) => {
    if (!selectedStickerRef) return;
    e.preventDefault();

    if (e.deltaY < 0) {
      selectedStickerRef.size = Math.min(300, selectedStickerRef.size + 8);
    } else {
      selectedStickerRef.size = Math.max(30, selectedStickerRef.size - 8);
    }
    renderPhotoStripCanvas();
  },
  { passive: false },
);

// ============================================================================
// FINAL STAGE PROCESSORS (QR Engine, Double Printing, & Timers)
// ============================================================================
if (masterSubmitBtn) {
  masterSubmitBtn.addEventListener("click", () => {
    viewDecor.classList.add("hidden");
    viewFinal.classList.remove("hidden");

    finalStripCanvas.width = STRIP_W;
    finalStripCanvas.height = STRIP_H;
    const finalCtx = finalStripCanvas.getContext("2d");
    finalCtx.drawImage(decorCanvas, 0, 0);

    qrCodeDiv.innerHTML = "";

    const uniqueSessionToken =
      Date.now() + "_" + Math.floor(Math.random() * 1000);
    const downloadURL = `https://icl.sites.gettysburg.edu/download?session=${uniqueSessionToken}`;

    qrCodeGeneratorInstance = new QRCode(qrCodeDiv, {
      text: downloadURL,
      width: 180,
      height: 180,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H,
    });

    launchFinalCountdown();
  });
}

function launchFinalCountdown() {
  clearInterval(finalTimerInterval);
  secondsRemaining = 30;
  finalCountdownSpan.innerText = secondsRemaining;

  finalTimerInterval = setInterval(() => {
    secondsRemaining--;
    finalCountdownSpan.innerText = secondsRemaining;

    if (secondsRemaining <= 0) {
      clearInterval(finalTimerInterval);
      resetToDefaultHomeView();
    }
  }, 1000);
}

function resetToDefaultHomeView() {
  clearInterval(finalTimerInterval);
  clearInterval(countdownTimerInterval);

  if (boothCamStream.srcObject) {
    boothCamStream.srcObject.getTracks().forEach((track) => track.stop());
    boothCamStream.srcObject = null;
  }

  capturedPhotosList = [];
  activePlacedStickers = [];
  liveFilter = "none";
  stripBackgroundColor = "#EB9AB2";

  viewFinal.classList.add("hidden");
  viewDecor.classList.add("hidden");
  viewCamera.classList.add("hidden");
  viewLayout.classList.add("hidden");
  viewHome.classList.remove("hidden");

  startCamera(video);
}

homeBtn.addEventListener("click", resetToDefaultHomeView);

printBtn.addEventListener("click", () => {
  const rawImageStream = decorCanvas.toDataURL("image/png");

  const printSpooler = document.getElementById("print-window-container");
  printSpooler.innerHTML = `
    <div class="print-page-instance"><img src="${rawImageStream}" /></div>
    <div class="print-page-instance"><img src="${rawImageStream}" /></div>
  `;

  window.print();
});

// Back Navigation Engines
const backToHomeBtn = document.getElementById("back-to-home");
const backToLayoutBtn = document.getElementById("back-to-layout");
const backToCameraBtn = document.getElementById("back-to-camera");

if (backToHomeBtn) {
  backToHomeBtn.addEventListener("click", () => {
    viewLayout.classList.add("hidden");
    viewHome.classList.remove("hidden");
  });
}

if (backToLayoutBtn) {
  backToLayoutBtn.addEventListener("click", () => {
    clearInterval(countdownTimerInterval);
    countdownOverlay.classList.add("hidden");

    if (boothCamStream.srcObject) {
      boothCamStream.srcObject.getTracks().forEach((track) => track.stop());
      boothCamStream.srcObject = null;
    }

    viewCamera.classList.add("hidden");
    viewLayout.classList.remove("hidden");
  });
}

if (backToCameraBtn) {
  backToCameraBtn.addEventListener("click", () => {
    viewDecor.classList.add("hidden");
    viewCamera.classList.remove("hidden");
    startCamera(boothCamStream);
  });
}
