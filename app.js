document.addEventListener('DOMContentLoaded', () => {
    /* === State Management === */
    const state = {
        currentTab: 'tab-img-to-pdf',
        imgToPdf: [], // { id, dataUrl, name, filters: {brightness, contrast, grayscale}, texts: [], crop: null }
        pdfToImg: [],
        cameraPdf: [],
        createPdf: [], // Mix of above
        
        cvReady: false,

        // Editor State
        editor: {
            activeTabState: null,
            activeIndex: -1,
            cropper: null,
            texts: []
        },
        
        // Camera State
        cameraStream: null
    };

    window.onOpenCvReadyCallback = function() {
        state.cvReady = true;
        const statusEl = document.getElementById('scanner-status');
        if(statusEl) {
            statusEl.textContent = "OpenCV Loaded. Ready to Scan.";
            setTimeout(() => statusEl.classList.add('hidden'), 2000);
        }
    };

    // Fix race condition if OpenCV loaded before this script
    if (typeof cv !== 'undefined' && typeof cv.Mat !== 'undefined') {
        window.onOpenCvReadyCallback();
    }

    /* === Utility Functions === */
    const generateId = () => Math.random().toString(36).substr(2, 9);
    
    const showLoading = (msg = 'Processing...') => {
        document.getElementById('loading-message').textContent = msg;
        document.getElementById('loading-overlay').classList.remove('hidden');
    };
    const hideLoading = () => document.getElementById('loading-overlay').classList.add('hidden');

    const fileToDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const createItemObj = (dataUrl, name) => ({
        id: generateId(), dataUrl, name,
        filters: { brightness: 100, contrast: 100, grayscale: 0 },
        texts: [], crop: null
    });

    async function rotateItemImage(item, direction) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const cvs = document.createElement('canvas');
                cvs.width = img.height;
                cvs.height = img.width;
                const ctx = cvs.getContext('2d');
                ctx.translate(cvs.width/2, cvs.height/2);
                if (direction === 'right') ctx.rotate(90 * Math.PI / 180);
                else ctx.rotate(-90 * Math.PI / 180);
                ctx.drawImage(img, -img.width/2, -img.height/2);
                item.dataUrl = cvs.toDataURL('image/jpeg', 0.95);
                if (item.crop) item.crop = null;
                resolve();
            };
            img.src = item.dataUrl;
        });
    }

    /* === Navigation === */
    const navLinks = document.querySelectorAll('.nav-links li');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(n => n.classList.remove('active'));
            link.classList.add('active');
            const targetId = link.getAttribute('data-tab');
            state.currentTab = targetId;
            tabPanes.forEach(pane => {
                if(pane.id === targetId) pane.classList.remove('hidden');
                else pane.classList.add('hidden');
            });
            
            // Cleanup camera if switching away
            if(targetId !== 'tab-camera-pdf') stopCamera();
        });
    });

    /* === Tab 1: Image to PDF === */
    const imgToPdfInput = document.getElementById('img-to-pdf-input');
    const imgToPdfUploadZone = document.getElementById('img-to-pdf-upload');
    const imgToPdfGrid = document.getElementById('img-to-pdf-grid');
    const imgToPdfActions = document.getElementById('img-to-pdf-actions');

    imgToPdfUploadZone.addEventListener('click', () => imgToPdfInput.click());
    
    // Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
        imgToPdfUploadZone.addEventListener(ev, preventDefaults, false);
    });

    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

    ['dragenter', 'dragover'].forEach(ev => {
        imgToPdfUploadZone.addEventListener(ev, () => imgToPdfUploadZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(ev => {
        imgToPdfUploadZone.addEventListener(ev, () => imgToPdfUploadZone.classList.remove('dragover'), false);
    });

    imgToPdfUploadZone.addEventListener('drop', e => handleImgToPdfFiles(e.dataTransfer.files));
    imgToPdfInput.addEventListener('change', e => handleImgToPdfFiles(e.target.files));

    async function handleImgToPdfFiles(files) {
        showLoading('Loading images...');
        for(let file of files) {
            if(!file.type.startsWith('image/')) continue;
            const dataUrl = await fileToDataUrl(file);
            state.imgToPdf.push(createItemObj(dataUrl, file.name));
        }
        renderGrid('imgToPdf', imgToPdfGrid, imgToPdfActions);
        imgToPdfInput.value = '';
        hideLoading();
    }

    document.querySelector('#tab-img-to-pdf .btn-clear').addEventListener('click', () => {
        state.imgToPdf = [];
        renderGrid('imgToPdf', imgToPdfGrid, imgToPdfActions);
    });

    document.getElementById('btn-generate-img-to-pdf').addEventListener('click', () => generatePdf(state.imgToPdf, 'ImagesToPDF.pdf'));


    /* === Tab 2: PDF to Image === */
    const pdfToImgInput = document.getElementById('pdf-to-img-input');
    const pdfToImgUploadZone = document.getElementById('pdf-to-img-upload');
    const pdfToImgGrid = document.getElementById('pdf-to-img-grid');
    const pdfToImgActions = document.getElementById('pdf-to-img-actions');

    pdfToImgUploadZone.addEventListener('click', () => pdfToImgInput.click());
    pdfToImgInput.addEventListener('change', e => handlePdfToImgFile(e.target.files[0]));
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => pdfToImgUploadZone.addEventListener(ev, preventDefaults, false));
    pdfToImgUploadZone.addEventListener('drop', e => handlePdfToImgFile(e.dataTransfer.files[0]));

    async function handlePdfToImgFile(file) {
        if(!file || file.type !== 'application/pdf') return;
        showLoading('Extracting pages...');
        try {
            const dataUrl = await fileToDataUrl(file);
            const pdf = await pdfjsLib.getDocument(dataUrl).promise;
            for(let i=1; i<=pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({scale: 2.0}); // high res
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({canvasContext: ctx, viewport: viewport}).promise;
                state.pdfToImg.push(createItemObj(canvas.toDataURL('image/jpeg', 0.9), `Page_${i}.jpg`));
            }
            renderGrid('pdfToImg', pdfToImgGrid, pdfToImgActions);
        } catch(e) {
            console.error(e);
            alert("Error reading PDF");
        }
        pdfToImgInput.value = '';
        hideLoading();
    }

    document.querySelector('#tab-pdf-to-img .btn-clear').addEventListener('click', () => {
        state.pdfToImg = [];
        renderGrid('pdfToImg', pdfToImgGrid, pdfToImgActions);
    });

    document.getElementById('btn-export-pdf-images').addEventListener('click', async () => {
        if(state.pdfToImg.length === 0) return;
        showLoading('Generating ZIP...');
        const zip = new JSZip();
        for(let i=0; i<state.pdfToImg.length; i++) {
            const finalData = await renderFinalImage(state.pdfToImg[i]);
            const base64 = finalData.split('base64,')[1];
            zip.file(`Page_${i+1}.jpg`, base64, {base64: true});
        }
        zip.generateAsync({type:"blob"}).then(content => {
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = "Extracted_Images.zip";
            a.click();
            hideLoading();
        });
    });


    /* === Tab 3: Camera PDF Scanner === */
    const scannerVideo = document.getElementById('scanner-video');
    const scannerCanvas = document.getElementById('scanner-canvas');
    const sctx = scannerCanvas.getContext('2d');
    const btnScannerStart = document.getElementById('btn-scanner-start');
    const btnScannerCapture = document.getElementById('btn-scanner-capture');
    const btnScannerSwitch = document.getElementById('btn-scanner-switch');
    const btnScannerLight = document.getElementById('btn-scanner-light');
    const btnScannerGallery = document.getElementById('btn-scanner-gallery');
    const scannerGalleryInput = document.getElementById('scanner-gallery-input');
    
    const cropUi = document.getElementById('scanner-crop-ui');
    const cropPolySvg = document.getElementById('scanner-crop-poly');
    const cropPoly = cropPolySvg.querySelector('polygon');
    const cropPoints = Array.from(document.querySelectorAll('.crop-point'));
    const editGroup = document.getElementById('scanner-edit-group');
    const btnScannerRecrop = document.getElementById('btn-scanner-re-crop');
    const btnScannerSliders = document.getElementById('btn-scanner-sliders');
    const scannerSlidersPopup = document.getElementById('scanner-sliders-popup');
    
    const sBrightness = document.getElementById('scanner-brightness');
    const sContrast = document.getElementById('scanner-contrast');
    const sDarkness = document.getElementById('scanner-darkness');
    const btnScannerRotLeft = document.getElementById('btn-scanner-rot-left');
    const btnScannerRotRight = document.getElementById('btn-scanner-rot-right');

    const thumbnailsStrip = document.getElementById('scanner-thumbnails-strip');
    const btnScannerAddPage = document.getElementById('btn-scanner-add-page');
    const btnScannerSavePdf = document.getElementById('btn-scanner-save-pdf');
    const scannerPageCount = document.getElementById('scanner-page-count');

    let useFrontCamera = false;
    let track = null;
    let scanLoopId = null;
    let rawCorners = null; 
    let scanMode = 'none'; // 'video', 'crop', 'preview'
    let fullResCanvas = document.createElement('canvas'); // Keep raw image
    let currentItem = null; // { filters, rotation }
    
    let draggingPoint = null;

    async function startScanner() {
        if (!state.cvReady) { alert("OpenCV is loading. Please wait."); return; }
        stopScanner();
        try {
            const constraints = { video: { facingMode: (useFrontCamera ? "user" : "environment") } };
            // Try to enable torch if available
            state.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            track = state.cameraStream.getVideoTracks()[0];
            scannerVideo.srcObject = state.cameraStream;
            
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            btnScannerLight.style.display = capabilities.torch ? 'inline-flex' : 'none';

            scannerVideo.onloadedmetadata = () => {
                scannerCanvas.width = scannerVideo.videoWidth;
                scannerCanvas.height = scannerVideo.videoHeight;
                scanMode = 'video';
                cropUi.classList.add('hidden');
                editGroup.classList.add('hidden');
                btnScannerCapture.disabled = false;
                scanLoop();
            };
        } catch (err) {
            console.error(err);
            alert("Camera access denied or unavailable.");
        }
    }

    function stopScanner() {
        if (state.cameraStream) {
            state.cameraStream.getTracks().forEach(t => t.stop());
            state.cameraStream = null;
            track = null;
        }
        if (scanLoopId) cancelAnimationFrame(scanLoopId);
    }

    btnScannerStart.addEventListener('click', () => {
        if(scanMode === 'video') stopScanner(); else startScanner();
    });

    btnScannerSwitch.addEventListener('click', () => {
        useFrontCamera = !useFrontCamera;
        if(state.cameraStream) startScanner();
    });

    btnScannerLight.addEventListener('click', () => {
        if(!track) return;
        let isLightOn = btnScannerLight.classList.contains('active');
        track.applyConstraints({advanced: [{torch: !isLightOn}]}).then(() => {
            btnScannerLight.classList.toggle('active');
        }).catch(e => console.error("Torch error", e));
    });

    btnScannerGallery.addEventListener('click', () => scannerGalleryInput.click());
    scannerGalleryInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        stopScanner();
        const dataUrl = await fileToDataUrl(file);
        const img = new Image();
        img.onload = () => {
            scannerCanvas.width = img.width;
            scannerCanvas.height = img.height;
            sctx.drawImage(img, 0, 0);
            
            fullResCanvas.width = img.width;
            fullResCanvas.height = img.height;
            fullResCanvas.getContext('2d').drawImage(img, 0, 0);
            
            scanMode = 'preview';
            detectAndCropFromCanvas(); // Auto detect on gallery image
        };
        img.src = dataUrl;
        scannerGalleryInput.value = '';
    });

    function sortCorners(pts) {
        pts.sort((a,b) => (a.y+a.x) - (b.y+b.x));
        let tl = pts[0]; let br = pts[3];
        let rem = [pts[1], pts[2]];
        rem.sort((a,b) => (a.y-a.x) - (b.y-b.x));
        let tr = rem[0]; let bl = rem[1];
        return [tl, tr, br, bl];
    }

    function scanLoop() {
        if (scanMode !== 'video') return;
        sctx.drawImage(scannerVideo, 0, 0, scannerCanvas.width, scannerCanvas.height);
        
        try {
            let src = cv.imread(scannerCanvas);
            let dst = new cv.Mat();
            cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
            cv.GaussianBlur(dst, dst, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
            cv.Canny(dst, dst, 75, 200, 3, false);
            
            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            cv.findContours(dst, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
            
            let maxArea = 0; let maxIndex = -1;
            for(let i=0; i<contours.size(); ++i) {
                let area = cv.contourArea(contours.get(i));
                if(area > maxArea && area > (scannerCanvas.width * scannerCanvas.height * 0.05)) { 
                    maxArea = area; maxIndex = i; 
                }
            }

            rawCorners = null;
            if (maxIndex !== -1) {
                let cnt = contours.get(maxIndex);
                let approx = new cv.Mat();
                let peri = cv.arcLength(cnt, true);
                cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
                if (approx.rows === 4) {
                    let pts = [];
                    for(let i=0; i<4; i++) pts.push({x: approx.data32S[i*2], y: approx.data32S[i*2+1]});
                    rawCorners = sortCorners(pts);
                    
                    // Draw outline
                    sctx.beginPath();
                    sctx.moveTo(rawCorners[0].x, rawCorners[0].y);
                    for(let i=1; i<4; i++) sctx.lineTo(rawCorners[i].x, rawCorners[i].y);
                    sctx.closePath();
                    sctx.lineWidth = 3; sctx.strokeStyle = '#6366f1'; sctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
                    sctx.stroke(); sctx.fill();
                }
                approx.delete();
            }
            src.delete(); dst.delete(); contours.delete(); hierarchy.delete();
        } catch(e) {}
        
        scanLoopId = requestAnimationFrame(scanLoop);
    }

    btnScannerCapture.addEventListener('click', () => {
        if(scanMode === 'crop') {
            // Apply crop
            applyManualCrop();
        } else if (scanMode === 'video' || scanMode === 'preview') {
            // Capture frame to fullResCanvas
            if(scanMode === 'video') {
                fullResCanvas.width = scannerVideo.videoWidth;
                fullResCanvas.height = scannerVideo.videoHeight;
                fullResCanvas.getContext('2d').drawImage(scannerVideo, 0, 0);
                stopScanner();
            }
            detectAndCropFromCanvas();
        }
    });

    function detectAndCropFromCanvas() {
        // Find corners on fullResCanvas if not already rawCorners mapped
        sctx.drawImage(fullResCanvas, 0, 0, scannerCanvas.width, scannerCanvas.height);
        try {
            let src = cv.imread(scannerCanvas);
            let dst = new cv.Mat();
            cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
            cv.GaussianBlur(dst, dst, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
            cv.Canny(dst, dst, 75, 200, 3, false);
            let contours = new cv.MatVector(), hierarchy = new cv.Mat();
            cv.findContours(dst, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
            
            let maxArea = 0, maxIndex = -1;
            for(let i=0; i<contours.size(); ++i) {
                let area = cv.contourArea(contours.get(i));
                if(area > maxArea) { maxArea = area; maxIndex = i; }
            }

            if (maxIndex !== -1) {
                let approx = new cv.Mat();
                cv.approxPolyDP(contours.get(maxIndex), approx, 0.02 * cv.arcLength(contours.get(maxIndex), true), true);
                if (approx.rows === 4) {
                    let pts = [];
                    for(let i=0; i<4; i++) pts.push({x: approx.data32S[i*2], y: approx.data32S[i*2+1]});
                    rawCorners = sortCorners(pts);
                } else rawCorners = null;
                approx.delete();
            } else rawCorners = null;
            src.delete(); dst.delete(); contours.delete(); hierarchy.delete();
        } catch(e) {}

        if(!rawCorners) {
            // Default to full image if no corners
            rawCorners = [
                {x: 0, y: 0}, {x: scannerCanvas.width, y: 0},
                {x: scannerCanvas.width, y: scannerCanvas.height}, {x: 0, y: scannerCanvas.height}
            ];
        }

        enterCropMode();
    }

    function enterCropMode() {
        scanMode = 'crop';
        sctx.drawImage(fullResCanvas, 0, 0, scannerCanvas.width, scannerCanvas.height);
        
        cropUi.classList.remove('hidden');
        editGroup.classList.add('hidden');
        btnScannerCapture.innerHTML = '<i class="fa-solid fa-check"></i>';
        
        // Setup crop points matching canvas aspect ratio to CSS layout
        updateCropUiFromCorners();
    }
    
    // Add point dragging logic
    let canvasRect = null;

    function getCanvasPos(e) {
        canvasRect = scannerCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // Scale to internal resolution
        let x = (clientX - canvasRect.left) / canvasRect.width * scannerCanvas.width;
        let y = (clientY - canvasRect.top) / canvasRect.height * scannerCanvas.height;
        return {x, y};
    }

    function updateCropUiFromCorners() {
        canvasRect = scannerCanvas.getBoundingClientRect();
        // Convert internal coordinates to window % for points
        cropPoints.forEach((pt, i) => {
            let px = (rawCorners[i].x / scannerCanvas.width) * 100;
            let py = (rawCorners[i].y / scannerCanvas.height) * 100;
            pt.style.left = `${px}%`;
            pt.style.top = `${py}%`;
        });
        
        let polyPts = rawCorners.map(c => `${(c.x/scannerCanvas.width)*100},${(c.y/scannerCanvas.height)*100}`).join(' ');
        cropPoly.setAttribute('points', polyPts);
    }
    
    // Setup listeners for points
    const upEvent = e => { draggingPoint = null; };
    const moveEvent = e => {
        if(!draggingPoint || scanMode !== 'crop') return;
        let pos = getCanvasPos(e);
        pos.x = Math.max(0, Math.min(pos.x, scannerCanvas.width));
        pos.y = Math.max(0, Math.min(pos.y, scannerCanvas.height));
        rawCorners[parseInt(draggingPoint.dataset.corner)] = pos;
        updateCropUiFromCorners();
    };

    cropPoints.forEach(pt => {
        pt.addEventListener('mousedown', e => { draggingPoint = pt; e.preventDefault(); });
        pt.addEventListener('touchstart', e => { draggingPoint = pt; });
    });
    
    window.addEventListener('mouseup', upEvent);
    window.addEventListener('touchend', upEvent);
    window.addEventListener('mousemove', moveEvent);
    window.addEventListener('touchmove', moveEvent, {passive: false});

    function applyManualCrop() {
        showLoading("Perspectivizing...");
        setTimeout(() => {
            try {
                // Scale corners to full image res
                let scaleX = fullResCanvas.width / scannerCanvas.width;
                let scaleY = fullResCanvas.height / scannerCanvas.height;
                let c = rawCorners.map(pt => ({x: pt.x * scaleX, y: pt.y * scaleY}));

                let src = cv.imread(fullResCanvas);
                let srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [c[0].x, c[0].y, c[1].x, c[1].y, c[2].x, c[2].y, c[3].x, c[3].y]);
                
                let w = Math.max(Math.hypot(c[2].x-c[3].x, c[2].y-c[3].y), Math.hypot(c[1].x-c[0].x, c[1].y-c[0].y));
                let h = Math.max(Math.hypot(c[1].x-c[2].x, c[1].y-c[2].y), Math.hypot(c[0].x-c[3].x, c[0].y-c[3].y));
                
                let dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, w-1, 0, w-1, h-1, 0, h-1]);
                let M = cv.getPerspectiveTransform(srcPts, dstPts);
                let warped = new cv.Mat();
                cv.warpPerspective(src, warped, M, new cv.Size(w, h), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
                
                cv.imshow(scannerCanvas, warped);
                // Also overwrite fullResCanvas so edits compound if we recrop
                fullResCanvas.width = warped.cols;
                fullResCanvas.height = warped.rows;
                cv.imshow(fullResCanvas, warped);
                
                src.delete(); warped.delete(); srcPts.delete(); dstPts.delete(); M.delete();

                // Create Item
                currentItem = {
                    dataUrl: scannerCanvas.toDataURL('image/jpeg', 0.9),
                    filters: { brightness: 0, contrast: 100, darkness: 0 },
                    rotation: 0
                };

                scanMode = 'preview';
                cropUi.classList.add('hidden');
                editGroup.classList.remove('hidden');
                btnScannerCapture.innerHTML = '<div class="inner-circle"></div>';
                btnScannerCapture.disabled = true; // In preview, capture is disabled
                applyScannerFilters();

                // Enable Add Page
                btnScannerAddPage.disabled = false;
                
            } catch(e) { console.error("Crop error", e); }
            hideLoading();
        }, 50);
    }

    // Sliders & Edits
    btnScannerSliders.addEventListener('click', () => scannerSlidersPopup.classList.toggle('hidden'));
    
    function applyScannerFilters() {
        if(!currentItem) return;
        const b = sBrightness.value;
        const c = sContrast.value;
        const d = sDarkness.value;
        
        // Simulating darkness by reducing composite brightness and increasing contrast for shadows
        let finalBright = 100 + parseInt(b) - (parseInt(d)*0.5);
        let finalCont = parseInt(c) + (parseInt(d)*0.2);

        scannerCanvas.style.filter = `brightness(${finalBright}%) contrast(${finalCont}%)`;
        const rotStr = `rotate(${currentItem.rotation}deg)`;
        scannerCanvas.style.transform = rotStr;
        
        currentItem.filters.brightness = b;
        currentItem.filters.contrast = c;
        currentItem.filters.darkness = d;
    }

    [sBrightness, sContrast, sDarkness].forEach(el => el.addEventListener('input', applyScannerFilters));

    btnScannerRotLeft.addEventListener('click', () => { if(currentItem) { currentItem.rotation -= 90; applyScannerFilters(); } });
    btnScannerRotRight.addEventListener('click', () => { if(currentItem) { currentItem.rotation += 90; applyScannerFilters(); } });

    btnScannerRecrop.addEventListener('click', () => {
        if(currentItem) enterCropMode(); // Uses last fullResCanvas
    });

    // Multi-page building
    btnScannerAddPage.addEventListener('click', () => {
        if(!currentItem) return;
        
        // Bake rotation/filters into dataUrl? For simplicity, we can do it via canvas 2D here.
        const bakedDataUrl = bakeItem(currentItem);
        state.cameraPdf.push({
            id: generateId(),
            dataUrl: bakedDataUrl,
            name: `Page_${state.cameraPdf.length+1}.jpg`
        });
        
        updateScannerThumbnails();
        btnScannerAddPage.disabled = true;
        editGroup.classList.add('hidden');
        scannerCanvas.style.filter = 'none';
        scannerCanvas.style.transform = 'none';
        sctx.clearRect(0, 0, scannerCanvas.width, scannerCanvas.height);
        
        currentItem = null;
        sBrightness.value = 0; sContrast.value = 100; sDarkness.value = 0;
        
        btnScannerSavePdf.disabled = false;
        
        if(state.cameraStream) {
           scanMode = 'video';
           btnScannerCapture.disabled = false;
        }
    });

    function bakeItem(item) {
        // Draw to temp canvas with filters and rotation
        const copyCvs = document.createElement('canvas');
        const img = new Image();
        img.src = fullResCanvas.toDataURL('image/jpeg', 1.0);
        
        const b = item.filters.brightness;
        const c = item.filters.contrast;
        const d = item.filters.darkness;
        let finalBright = 100 + parseInt(b) - (parseInt(d)*0.5);
        let finalCont = parseInt(c) + (parseInt(d)*0.2);

        if(item.rotation % 180 !== 0) {
            copyCvs.width = fullResCanvas.height;
            copyCvs.height = fullResCanvas.width;
        } else {
            copyCvs.width = fullResCanvas.width;
            copyCvs.height = fullResCanvas.height;
        }

        const xctx = copyCvs.getContext('2d');
        xctx.translate(copyCvs.width/2, copyCvs.height/2);
        xctx.rotate(item.rotation * Math.PI / 180);
        xctx.filter = `brightness(${finalBright}%) contrast(${finalCont}%)`;
        xctx.drawImage(img, -fullResCanvas.width/2, -fullResCanvas.height/2);
        
        return copyCvs.toDataURL('image/jpeg', 0.9);
    }

    function updateScannerThumbnails() {
        thumbnailsStrip.innerHTML = '';
        state.cameraPdf.forEach((p, i) => {
            const thumb = document.createElement('div');
            thumb.className = 'scanned-thumb';
            thumb.innerHTML = `<img src="${p.dataUrl}">`;
            // could add delete overlay here
            thumb.ondblclick = () => {
                if(confirm('Remove this page?')) {
                    state.cameraPdf.splice(i, 1);
                    updateScannerThumbnails();
                }
            };
            thumbnailsStrip.appendChild(thumb);
        });
        scannerPageCount.textContent = state.cameraPdf.length;
        if(state.cameraPdf.length === 0) btnScannerSavePdf.disabled = true;
    }

    // PDF Generation for Scanner Tab
    btnScannerSavePdf.addEventListener('click', async () => {
        if(state.cameraPdf.length === 0) return;
        showLoading('Generating A4 PDF...');
        
        const { jsPDF } = window.jspdf;
        // A4 params
        const pdf = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4'});
        const a4w = 210; const a4h = 297;
        
        for(let i=0; i<state.cameraPdf.length; i++) {
            const imgEl = new Image();
            await new Promise(r => { imgEl.onload = r; imgEl.src = state.cameraPdf[i].dataUrl; });

            if(i > 0) pdf.addPage();
            
            // Auto scale to A4 preserving aspect ratio leaving margins (e.g., 5mm)
            const margin = 5;
            const pw = a4w - margin*2;
            const ph = a4h - margin*2;
            const scale = Math.min(pw / imgEl.width, ph / imgEl.height);
            const drawW = imgEl.width * scale;
            const drawH = imgEl.height * scale;
            const x = (a4w - drawW) / 2;
            const y = (a4h - drawH) / 2;

            pdf.addImage(imgEl.src, 'JPEG', x, y, drawW, drawH);
        }
        
        pdf.save('Scanned_Document.pdf');
        
        // Clean up
        state.cameraPdf = [];
        updateScannerThumbnails();
        hideLoading();
    });


    /* === Tab 4: Create PDF (Advanced) === */
    const createPdfInput = document.getElementById('create-pdf-input');
    const createPdfUploadZone = document.getElementById('create-pdf-upload');
    const createPdfGrid = document.getElementById('create-pdf-grid');
    const createPdfActions = document.getElementById('create-pdf-actions');
    const totalPagesDisplay = document.getElementById('total-pages-display');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => createPdfUploadZone.addEventListener(ev, preventDefaults, false));
    createPdfUploadZone.addEventListener('drop', e => handleCreatePdfFiles(e.dataTransfer.files));
    createPdfInput.addEventListener('change', e => handleCreatePdfFiles(e.target.files));

    async function handleCreatePdfFiles(files) {
        showLoading('Importing files...');
        for(let file of files) {
            if(file.type.startsWith('image/')) {
                const dataUrl = await fileToDataUrl(file);
                state.createPdf.push(createItemObj(dataUrl, file.name));
            } else if (file.type === 'application/pdf') {
                try {
                    const dataUrl = await fileToDataUrl(file);
                    const pdf = await pdfjsLib.getDocument(dataUrl).promise;
                    for(let i=1; i<=pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const viewport = page.getViewport({scale: 2.0});
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        await page.render({canvasContext: ctx, viewport: viewport}).promise;
                        state.createPdf.push(createItemObj(canvas.toDataURL('image/jpeg', 0.9), `${file.name}_P${i}.jpg`));
                    }
                } catch(e) { console.error(e); }
            }
        }
        renderGrid('createPdf', createPdfGrid, createPdfActions);
        createPdfInput.value = '';
        hideLoading();
    }

    document.querySelector('#tab-create-pdf .btn-clear').addEventListener('click', () => {
        state.createPdf = [];
        renderGrid('createPdf', createPdfGrid, createPdfActions);
    });

    document.getElementById('btn-generate-create-pdf').addEventListener('click', () => generatePdf(state.createPdf, 'Master.pdf'));

    // Enable drag and drop sorting for all grids using SortableJS
    const gridsToMakeSortable = [
        { key: 'imgToPdf', grid: imgToPdfGrid, actions: imgToPdfActions },
        { key: 'pdfToImg', grid: pdfToImgGrid, actions: pdfToImgActions },
        { key: 'createPdf', grid: createPdfGrid, actions: createPdfActions }
    ];

    gridsToMakeSortable.forEach(({ key, grid, actions }) => {
        new Sortable(grid, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const item = state[key].splice(evt.oldIndex, 1)[0];
                state[key].splice(evt.newIndex, 0, item);
                renderGrid(key, grid, actions);
            }
        });
    });

    /* === Replace Page Functionality === */
    const replaceModal = document.getElementById('replace-modal');
    const replaceInput = document.getElementById('replace-input');
    const btnCloseReplace = document.getElementById('btn-close-replace');
    let replaceItemIndex = -1;

    btnCloseReplace.addEventListener('click', () => replaceModal.classList.add('hidden'));
    
    document.getElementById('replace-upload').addEventListener('click', () => replaceInput.click());
    replaceInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if(!file) return;
        showLoading('Replacing...');
        replaceModal.classList.add('hidden');
        
        let newItems = [];
        if(file.type.startsWith('image/')) {
            const dataUrl = await fileToDataUrl(file);
            newItems.push(createItemObj(dataUrl, file.name));
        } else if (file.type === 'application/pdf') {
            try {
                const dataUrl = await fileToDataUrl(file);
                const pdf = await pdfjsLib.getDocument(dataUrl).promise;
                for(let i=1; i<=pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({scale: 2.0});
                    const canvas = document.createElement('canvas');
                    await page.render({canvasContext: canvas.getContext('2d'), viewport: viewport}).promise;
                    newItems.push(createItemObj(canvas.toDataURL('image/jpeg', 0.9), `${file.name}_P${i}.jpg`));
                }
            } catch(err) {}
        }
        
        if(newItems.length > 0) {
            // Replace the 1 item at replaceItemIndex with N new items
            state.createPdf.splice(replaceItemIndex, 1, ...newItems);
            renderGrid('createPdf', createPdfGrid, createPdfActions);
        }
        replaceInput.value = '';
        hideLoading();
    });


    /* === Common Grid Rendering === */
    function renderGrid(stateKey, gridEl, actionsEl) {
        gridEl.innerHTML = '';
        const items = state[stateKey];
        if(items.length > 0) {
            actionsEl.classList.remove('hidden');
        } else {
            actionsEl.classList.add('hidden');
        }
        
        // Update counts
        if(document.getElementById(`${stateKey.toLowerCase().replace('topdf', '-to-pdf').replace('toimg', '-to-img')}-count`)) {
             document.getElementById(`${stateKey.toLowerCase().replace('topdf', '-to-pdf').replace('toimg', '-to-img')}-count`).textContent = items.length;
        }
        if(stateKey === 'createPdf') {
            totalPagesDisplay.textContent = items.length;
        }

        items.forEach((item, index) => {
            const col = document.createElement('div');
            col.className = 'item-card';
            
            // Generate a quick thumbnail applying filters structurally without canvas for speed, or canvas if crop exists
            // To be accurate, we'd render via canvas. For UI speed, we just use the raw image and CSS filters if no crop.
            
            col.innerHTML = `
                <div class="item-preview">
                    <img src="${item.dataUrl}" style="filter: brightness(${item.filters.brightness}%) contrast(${item.filters.contrast}%) grayscale(${item.filters.grayscale}%)">
                    <div class="item-overlay">
                        <button class="btn-icon btn-move-left" title="Move Left" ${index === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}><i class="fa-solid fa-arrow-left"></i></button>
                        <button class="btn-icon btn-move-right" title="Move Right" ${index === items.length - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}><i class="fa-solid fa-arrow-right"></i></button>
                        <button class="btn-icon btn-rot-left" title="Rotate Left"><i class="fa-solid fa-rotate-left"></i></button>
                        <button class="btn-icon btn-rot-right" title="Rotate Right"><i class="fa-solid fa-rotate-right"></i></button>
                        <button class="btn-icon btn-edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon btn-save-pdf" title="Save this as PDF"><i class="fa-solid fa-file-pdf"></i></button>
                        ${stateKey === 'createPdf' ? `<button class="btn-icon btn-replace" title="Replace"><i class="fa-solid fa-file-import"></i></button>` : ''}
                        <button class="btn-icon danger btn-delete" title="Remove"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="item-info">
                    <span class="page-badge">${index + 1}</span>
                    <span class="item-name" title="${item.name}">${item.name}</span>
                </div>
            `;
            
            const btnMoveLeft = col.querySelector('.btn-move-left');
            if(btnMoveLeft && !btnMoveLeft.disabled) {
                btnMoveLeft.addEventListener('click', () => {
                    const movedItem = state[stateKey].splice(index, 1)[0];
                    state[stateKey].splice(index - 1, 0, movedItem);
                    renderGrid(stateKey, gridEl, actionsEl);
                });
            }
            
            const btnMoveRight = col.querySelector('.btn-move-right');
            if(btnMoveRight && !btnMoveRight.disabled) {
                btnMoveRight.addEventListener('click', () => {
                    const movedItem = state[stateKey].splice(index, 1)[0];
                    state[stateKey].splice(index + 1, 0, movedItem);
                    renderGrid(stateKey, gridEl, actionsEl);
                });
            }

            col.querySelector('.btn-rot-left').addEventListener('click', async () => {
                showLoading('Rotating...');
                await rotateItemImage(item, 'left');
                renderGrid(stateKey, gridEl, actionsEl);
                hideLoading();
            });
            col.querySelector('.btn-rot-right').addEventListener('click', async () => {
                showLoading('Rotating...');
                await rotateItemImage(item, 'right');
                renderGrid(stateKey, gridEl, actionsEl);
                hideLoading();
            });
            col.querySelector('.btn-delete').addEventListener('click', () => {
                state[stateKey].splice(index, 1);
                renderGrid(stateKey, gridEl, actionsEl);
            });
            
            col.querySelector('.btn-edit').addEventListener('click', () => {
                openEditor(stateKey, index);
            });

            const btnSavePdf = col.querySelector('.btn-save-pdf');
            if(btnSavePdf) {
                btnSavePdf.addEventListener('click', () => {
                   const defaultName = item.name ? item.name.replace(/\.[^/.]+$/, "") + ".pdf" : "Document.pdf";
                   generatePdf([item], defaultName);
                });
            }

            if(stateKey === 'createPdf') {
                col.querySelector('.btn-replace').addEventListener('click', () => {
                    replaceItemIndex = index;
                    replaceModal.classList.remove('hidden');
                });
            }

            gridEl.appendChild(col);
        });
    }

    /* === Global Image Editor === */
    const editorModal = document.getElementById('editor-modal');
    const editorPreview = document.getElementById('editor-image-preview');
    const filterBrightness = document.getElementById('filter-brightness');
    const filterContrast = document.getElementById('filter-contrast');
    const filterGrayscale = document.getElementById('filter-grayscale');
    const textInput = document.getElementById('text-input');
    const textColor = document.getElementById('text-color');
    const textBgColor = document.getElementById('text-bg-color');
    const textsList = document.getElementById('text-elements-list');

    document.getElementById('btn-close-editor').addEventListener('click', closeEditor);
    document.getElementById('btn-cancel-edit').addEventListener('click', closeEditor);
    document.getElementById('btn-save-edit').addEventListener('click', saveEditor);

    // Editor Tabs
    document.querySelectorAll('.editor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.editor-tab-content').forEach(c => c.classList.add('hidden'));
            tab.classList.add('active');
            document.getElementById(`editor-panel-${tab.dataset.target}`).classList.remove('hidden');
        });
    });

    document.getElementById('btn-reset-filters').addEventListener('click', () => {
        filterBrightness.value = 100;
        filterContrast.value = 100;
        filterGrayscale.value = 0;
        updateFiltersUI();
    });

    [filterBrightness, filterContrast, filterGrayscale].forEach(el => {
        el.addEventListener('input', updateFiltersUI);
    });

    function updateFiltersUI() {
        document.getElementById('val-brightness').textContent = filterBrightness.value + '%';
        document.getElementById('val-contrast').textContent = filterContrast.value + '%';
        document.getElementById('val-grayscale').textContent = filterGrayscale.value + '%';
        
        const filterStr = `brightness(${filterBrightness.value}%) contrast(${filterContrast.value}%) grayscale(${filterGrayscale.value}%)`;
        editorPreview.style.filter = filterStr;
        if(state.editor.cropper) {
            document.querySelector('.cropper-container').style.filter = filterStr;
        }
    }

    // Cropper Actions
    document.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            if(state.editor.cropper) {
                const ratio = parseFloat(e.target.dataset.ratio);
                state.editor.cropper.setAspectRatio(isNaN(ratio) ? NaN : ratio);
            }
        });
    });

    document.getElementById('btn-apply-crop').addEventListener('click', () => {
        if(state.editor.cropper) {
            const cd = state.editor.cropper.getData(true);
            state.editor.crop = cd;
            alert("Crop boundary updated.");
        }
    });

    // Text Actions
    document.getElementById('btn-add-text').addEventListener('click', () => {
        if(!textInput.value) return;
        const newText = {
            id: generateId(),
            text: textInput.value,
            color: textColor.value,
            bg: textBgColor.value,
            x: 50, y: 50 // initial perc positions
        };
        state.editor.texts.push(newText);
        textInput.value = '';
        renderTextList();
    });

    function renderTextList() {
        textsList.innerHTML = '';
        state.editor.texts.forEach((t, i) => {
            const div = document.createElement('div');
            div.className = 'text-item-ui';
            div.innerHTML = `
                <span><strong>${t.text}</strong></span>
                <div style="display:flex; gap:10px; align-items:center;">
                    <div style="width:15px; height:15px; background:${t.color}; border:1px solid #ccc;"></div>
                    <div style="width:15px; height:15px; background:${t.bg}; border:1px solid #ccc;"></div>
                    <button data-index="${i}"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            div.querySelector('button').addEventListener('click', e => {
                state.editor.texts.splice(parseInt(e.currentTarget.dataset.index), 1);
                renderTextList();
            });
            textsList.appendChild(div);
        });
    }

    function openEditor(stateKey, index, defaultTab = 'adjust') {
        state.editor.activeTabState = stateKey;
        state.editor.activeIndex = index;
        const item = state[stateKey][index];
        
        document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.editor-tab-content').forEach(c => c.classList.add('hidden'));
        const tabBtn = document.querySelector(`.editor-tab[data-target="${defaultTab}"]`);
        if(tabBtn) {
            tabBtn.classList.add('active');
            document.getElementById(`editor-panel-${defaultTab}`).classList.remove('hidden');
        }
        
        editorPreview.src = item.dataUrl;
        
        // Load Filters
        filterBrightness.value = item.filters.brightness;
        filterContrast.value = item.filters.contrast;
        filterGrayscale.value = item.filters.grayscale;
        updateFiltersUI();

        // Load Texts
        state.editor.texts = JSON.parse(JSON.stringify(item.texts || []));
        renderTextList();

        editorModal.classList.remove('hidden');

        // Init Cropper
        if(state.editor.cropper) state.editor.cropper.destroy();
        state.editor.cropper = new Cropper(editorPreview, {
            viewMode: 1,
            dragMode: 'crop',
            autoCropArea: 1,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
            ready: function () {
                if(item.crop) {
                    this.cropper.setData(item.crop);
                }
            }
        });
    }

    function closeEditor() {
        editorModal.classList.add('hidden');
        if(state.editor.cropper) {
            state.editor.cropper.destroy();
            state.editor.cropper = null;
        }
    }

    function saveEditor() {
        const item = state[state.editor.activeTabState][state.editor.activeIndex];
        item.filters = {
            brightness: parseInt(filterBrightness.value),
            contrast: parseInt(filterContrast.value),
            grayscale: parseInt(filterGrayscale.value)
        };
        item.texts = JSON.parse(JSON.stringify(state.editor.texts));
        if(state.editor.cropper) {
            item.crop = state.editor.cropper.getData(true);
        }
        
        closeEditor();
        
        // Re-render current tab grid
        let gridEl, actEl;
        if(state.editor.activeTabState === 'imgToPdf') { gridEl=imgToPdfGrid; actEl=imgToPdfActions; }
        else if(state.editor.activeTabState === 'pdfToImg') { gridEl=pdfToImgGrid; actEl=pdfToImgActions; }
        else if(state.editor.activeTabState === 'cameraPdf') { gridEl=cameraGrid; actEl=cameraActions; }
        else if(state.editor.activeTabState === 'createPdf') { gridEl=createPdfGrid; actEl=createPdfActions; }
        
        if(gridEl) renderGrid(state.editor.activeTabState, gridEl, actEl);
    }

    /* === PDF Generation & Final Rendering === */
    async function renderFinalImage(item) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const cvs = document.createElement('canvas');
                const ctx = cvs.getContext('2d');
                
                // 1. Determine size & Crop
                let sourceX = 0, sourceY = 0, sourceW = img.width, sourceH = img.height;
                if(item.crop) {
                    sourceX = item.crop.x; sourceY = item.crop.y;
                    sourceW = item.crop.width; sourceH = item.crop.height;
                }
                
                cvs.width = sourceW;
                cvs.height = sourceH;

                // 2. Base Filters
                ctx.filter = `brightness(${item.filters.brightness}%) contrast(${item.filters.contrast}%) grayscale(${item.filters.grayscale}%)`;
                ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, cvs.width, cvs.height);
                ctx.filter = 'none';

                // 3. Texts
                if(item.texts && item.texts.length > 0) {
                    item.texts.forEach(t => {
                        const fontSize = Math.max(20, cvs.height * 0.05); // dynamic font size
                        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
                        
                        const textW = ctx.measureText(t.text).width;
                        const pxX = (t.x / 100) * cvs.width;
                        const pxY = (t.y / 100) * cvs.height;
                        
                        // Draw bg
                        ctx.fillStyle = t.bg;
                        ctx.fillRect(pxX, pxY - fontSize, textW + 20, fontSize + 10);
                        
                        // Draw text
                        ctx.fillStyle = t.color;
                        ctx.fillText(t.text, pxX + 10, pxY);
                    });
                }
                
                resolve(cvs.toDataURL('image/jpeg', 0.95));
            };
            img.src = item.dataUrl;
        });
    }

    async function generatePdf(itemArray, filename) {
        if(itemArray.length === 0) return;
        showLoading('Generating PDF...');
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        for(let i=0; i<itemArray.length; i++) {
            const dataUrl = await renderFinalImage(itemArray[i]);
            
            // Get img dimensions to fit page
            const img = new Image();
            await new Promise(r => { img.onload = r; img.src = dataUrl; });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const ratio = Math.min(pdfWidth / img.width, pdfHeight / img.height);
            const w = img.width * ratio;
            const h = img.height * ratio;
            const x = (pdfWidth - w) / 2;
            const y = (pdfHeight - h) / 2;

            if(i > 0) pdf.addPage();
            pdf.addImage(dataUrl, 'JPEG', x, y, w, h);
        }
        
        pdf.save(filename);
        hideLoading();
    }
});
