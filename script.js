const { jsPDF } = window.jspdf;
    let stream = null;
    let pages = [];
    let currentImage = null;
    let cropBounds = { x: 0.1, y: 0.2, width: 0.8, height: 0.6 }; // Relative to viewport
    let isDragging = null;

    // Screen Management
    function showScreen(id) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById(id).classList.add('active');
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2000);
    }

    // Camera
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1080 }, height: { ideal: 1920 } } 
        });
        document.getElementById('camera-feed').srcObject = stream;
        showScreen('camera-view');
      } catch (err) {
        showToast('Camera permission denied or not available');
        console.error(err);
      }
    }

    function stopCamera() {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
      showScreen('home');
    }

    // Capture & Crop
    function captureImage() {
      const video = document.getElementById('camera-feed');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const sx = cropBounds.x * canvas.width;
      const sy = cropBounds.y * canvas.height;
      const sw = cropBounds.width * canvas.width;
      const sh = cropBounds.height * canvas.height;

      const cropped = document.createElement('canvas');
      const cctx = cropped.getContext('2d');
      cropped.width = sw;
      cropped.height = sh;
      cctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

      currentImage = cropped;
      loadEditor();
      stopCamera();
    }

    // Crop Drag Logic
    document.querySelectorAll('.crop-handle').forEach(handle => {
      handle.addEventListener('touchstart', startDrag);
      handle.addEventListener('mousedown', startDrag);
    });

    function startDrag(e) {
      e.preventDefault();
      isDragging = e.target.dataset.corner;
      document.addEventListener('touchmove', onDrag);
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('touchend', stopDrag);
      document.addEventListener('mouseup', stopDrag);
    }

    function onDrag(e) {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let nx = Math.max(0.05, Math.min(0.95, clientX / vw));
      let ny = Math.max(0.05, Math.min(0.95, clientY / vh));

      const box = document.getElementById('crop-box');
      let rect = box.getBoundingClientRect();

      if (isDragging === 'tl') { box.style.left = (nx * 100) + '%'; box.style.top = (ny * 100) + '%'; }
      else if (isDragging === 'tr') { box.style.right = ((1 - nx) * 100) + '%'; box.style.top = (ny * 100) + '%'; }
      else if (isDragging === 'bl') { box.style.left = (nx * 100) + '%'; box.style.bottom = ((1 - ny) * 100) + '%'; }
      else if (isDragging === 'br') { box.style.right = ((1 - nx) * 100) + '%'; box.style.bottom = ((1 - ny) * 100) + '%'; }

      updateCropBounds();
    }

    function stopDrag() {
      isDragging = null;
      document.removeEventListener('touchmove', onDrag);
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('touchend', stopDrag);
      document.removeEventListener('mouseup', stopDrag);
    }

    function updateCropBounds() {
      const box = document.getElementById('crop-box');
      const style = window.getComputedStyle(box);
      cropBounds.x = parseFloat(style.left) / 100;
      cropBounds.y = parseFloat(style.top) / 100;
      cropBounds.width = parseFloat(style.width) / window.innerWidth;
      cropBounds.height = parseFloat(style.height) / window.innerHeight;
    }

    // Editor & Filters
    function loadEditor() {
      const canvas = document.getElementById('preview-canvas');
      canvas.width = currentImage.width;
      canvas.height = currentImage.height;
      applyFilters();
      showScreen('editor-view');
    }

    function applyFilters() {
      const canvas = document.getElementById('preview-canvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const brightness = parseInt(document.getElementById('brightness').value);
      const contrast = parseInt(document.getElementById('contrast').value);
      const sharp = parseInt(document.getElementById('sharpness').value);
      const thresh = parseInt(document.getElementById('threshold').value);
      const txtCol = document.getElementById('text-color').value;
      const bgCol = document.getElementById('bg-color').value;

      // Draw base
      ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

      // Apply standard filters
      ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tctx = tempCanvas.getContext('2d');
      tctx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.filter = 'none';

      // Text Clarity (Thresholding)
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const rTxt = parseInt(txtCol.slice(1,3), 16);
      const gTxt = parseInt(txtCol.slice(3,5), 16);
      const bTxt = parseInt(txtCol.slice(5,7), 16);
      const rBg = parseInt(bgCol.slice(1,3), 16);
      const gBg = parseInt(bgCol.slice(3,5), 16);
      const bBg = parseInt(bgCol.slice(5,7), 16);

      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        if (gray > thresh) {
          data[i] = rBg; data[i+1] = gBg; data[i+2] = bBg;
        } else {
          data[i] = rTxt; data[i+1] = gTxt; data[i+2] = bTxt;
        }
        // Simple sharpness boost via contrast clamping
        if (sharp > 0) {
          const factor = 1 + (sharp / 100);
          data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));
          data[i+1] = Math.min(255, Math.max(0, (data[i+1] - 128) * factor + 128));
          data[i+2] = Math.min(255, Math.max(0, (data[i+2] - 128) * factor + 128));
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Gallery Import
    function handleGallery(files) {
      if (!files.length) return;
      const file = files[0];
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          currentImage = img;
          loadEditor();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    // Page Management
    function addPage() {
      pages.push(document.getElementById('preview-canvas').toDataURL('image/jpeg', 0.9));
      document.getElementById('page-count').textContent = `${pages.length + 1} Pages`;
      showToast('Page saved. Scan next document.');
      startCamera();
    }

    async function convertToPDF() {
      const loading = document.getElementById('loading');
      loading.classList.remove('hidden');
      
      // Add current page
      pages.push(document.getElementById('preview-canvas').toDataURL('image/jpeg', 0.9));
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        const img = new Image();
        img.src = pages[i];
        await new Promise(res => img.onload = res);
        
        const ratio = Math.min(pageW / img.width, pageH / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;
        pdf.addImage(pages[i], 'JPEG', x, y, w, h);
      }

      pdf.save('scanned-document.pdf');
      
      // Reset
      pages = [];
      currentImage = null;
      document.getElementById('page-count').textContent = '1 Page';
      document.getElementById('brightness').value = 0;
      document.getElementById('contrast').value = 0;
      document.getElementById('sharpness').value = 0;
      document.getElementById('threshold').value = 128;
      document.getElementById('text-color').value = '#000000';
      document.getElementById('bg-color').value = '#ffffff';
      loading.classList.add('hidden');
      showToast('PDF downloaded. Ready for next scan!');
      setTimeout(() => showScreen('home'), 800);
    }

    // Init
    window.addEventListener('load', () => {
      // Ensure crop box stays centered on resize
      window.addEventListener('resize', updateCropBounds);
    });