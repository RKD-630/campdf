document.addEventListener('DOMContentLoaded', () => {
    /* === State Management === */
    const state = {
        currentTab: 'tab-img-to-pdf',
        imgToPdf: [], // { id, dataUrl, name, filters: {brightness, contrast, grayscale}, texts: [], crop: null }
        pdfToImg: [],
        pdfToPdf: [],
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
        texts: [], crop: null, selected: false
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
    const navLinks = document.querySelectorAll('.nav-links li[data-tab]');
    const tabPanes = document.querySelectorAll('.tab-pane');

    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            btnThemeToggle.querySelector('i').className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            btnThemeToggle.title = isLight ? 'Dark Mode' : 'Light Mode';
        });
    }

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
            
            // Cleanup camera if switching away (legacy support)
            if(typeof stopCamera === 'function') stopCamera();
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

    document.getElementById('btn-generate-img-to-pdf').addEventListener('click', () => {
        const itemsToExport = state.imgToPdf.some(i => i.selected) ? state.imgToPdf.filter(i => i.selected) : state.imgToPdf;
        const pwd = document.getElementById('img-pdf-password') ? document.getElementById('img-pdf-password').value : null;
        if(pwd && !/^\d{4}$/.test(pwd)) {
            alert("Password must be exactly 4 digits.");
            return;
        }
        generatePdf(itemsToExport, 'ImagesToPDF.pdf', pwd);
    });


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
                
                if (i % 5 === 0) {
                    document.getElementById('loading-message').textContent = `Extracting page ${i} of ${pdf.numPages}...`;
                    await new Promise(r => setTimeout(r, 0));
                }
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
                        
                        if (i % 5 === 0) {
                            document.getElementById('loading-message').textContent = `Processing page ${i} of ${pdf.numPages}...`;
                            await new Promise(r => setTimeout(r, 0));
                        }
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

    /* === Tab 5: PDF to PDF === */
    const pdfToPdfInput = document.getElementById('pdf-to-pdf-input');
    const pdfToPdfUploadZone = document.getElementById('pdf-to-pdf-upload');
    const pdfToPdfGrid = document.getElementById('pdf-to-pdf-grid');
    const pdfToPdfActions = document.getElementById('pdf-to-pdf-actions');
    const btnPdfUndo = document.getElementById('btn-pdf-undo');
    const btnPdfRedo = document.getElementById('btn-pdf-redo');
    const btnPdfZoomIn = document.getElementById('btn-pdf-zoom-in');
    const btnPdfZoomOut = document.getElementById('btn-pdf-zoom-out');
    const pdfZoomLevelText = document.getElementById('pdf-zoom-level');
    let pdfZoomLevel = 100;

    let pdfToPdfUndoStack = [];
    let pdfToPdfRedoStack = [];
    const pdfSourceCache = {}; // fileId -> arrayBuffer

    function savePdfToPdfState(isRedoUndo = false) {
        if(!isRedoUndo) {
            pdfToPdfUndoStack.push(JSON.parse(JSON.stringify(state.pdfToPdf)));
            pdfToPdfRedoStack = [];
            updateUndoRedoBtns();
        }
    }

    function updateUndoRedoBtns() {
        btnPdfUndo.disabled = pdfToPdfUndoStack.length === 0;
        btnPdfRedo.disabled = pdfToPdfRedoStack.length === 0;
    }

    btnPdfUndo.addEventListener('click', () => {
        if(pdfToPdfUndoStack.length > 0) {
            pdfToPdfRedoStack.push(JSON.parse(JSON.stringify(state.pdfToPdf)));
            state.pdfToPdf = pdfToPdfUndoStack.pop();
            updateUndoRedoBtns();
            renderGrid('pdfToPdf', pdfToPdfGrid, pdfToPdfActions);
        }
    });

    btnPdfRedo.addEventListener('click', () => {
        if(pdfToPdfRedoStack.length > 0) {
            pdfToPdfUndoStack.push(JSON.parse(JSON.stringify(state.pdfToPdf)));
            state.pdfToPdf = pdfToPdfRedoStack.pop();
            updateUndoRedoBtns();
            renderGrid('pdfToPdf', pdfToPdfGrid, pdfToPdfActions);
        }
    });

    btnPdfZoomIn.addEventListener('click', () => {
        if(pdfZoomLevel < 200) pdfZoomLevel += 25;
        updatePdfZoom();
    });
    btnPdfZoomOut.addEventListener('click', () => {
        if(pdfZoomLevel > 50) pdfZoomLevel -= 25;
        updatePdfZoom();
    });

    function updatePdfZoom() {
        pdfZoomLevelText.textContent = pdfZoomLevel + '%';
        pdfToPdfGrid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${150 * (pdfZoomLevel/100)}px, 1fr))`;
    }

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => pdfToPdfUploadZone.addEventListener(ev, preventDefaults, false));
    pdfToPdfUploadZone.addEventListener('drop', e => handlePdfToPdfFiles(e.dataTransfer.files));
    pdfToPdfInput.addEventListener('change', e => handlePdfToPdfFiles(e.target.files));

    async function handlePdfToPdfFiles(files) {
        showLoading('Importing PDF(s)...');
        savePdfToPdfState();
        for(let file of files) {
            if(file.type === 'application/pdf') {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const fileId = generateId();
                    pdfSourceCache[fileId] = arrayBuffer;
                    
                    const dataUrl = await fileToDataUrl(file);
                    const pdf = await pdfjsLib.getDocument(dataUrl).promise;
                    
                    const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%231e293b'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%2394a3b8'%3ELoading...%3C/text%3E%3C/svg%3E";

                    for(let i=1; i<=pdf.numPages; i++) {
                        const itemObj = createItemObj(placeholder, `${file.name}_P${i}.pdf`);
                        itemObj.pdfInfo = { fileId, pageIndex: i - 1 };
                        itemObj.renderPending = true;
                        state.pdfToPdf.push(itemObj);
                    }
                    
                    // Render placeholders immediately
                    renderGrid('pdfToPdf', pdfToPdfGrid, pdfToPdfActions);
                    
                    // Async thumbnail generation
                    renderPdfThumbnailsAsync(pdf, fileId, state.pdfToPdf);
                } catch(e) { console.error("Error reading PDF:", e); }
            }
        }
        pdfToPdfInput.value = '';
        hideLoading();
    }

    async function renderPdfThumbnailsAsync(pdf, fileId, stateArray) {
        for(let i=1; i<=pdf.numPages; i++) {
            const item = stateArray.find(it => it.pdfInfo && it.pdfInfo.fileId === fileId && it.pdfInfo.pageIndex === (i-1));
            if(!item || !item.renderPending) continue;

            try {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({scale: 0.5}); // Fast low res
                const canvas = document.createElement('canvas');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({canvasContext: canvas.getContext('2d'), viewport: viewport}).promise;
                
                item.dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                item.renderPending = false;
                
                const imgEl = document.getElementById(`img-prev-${item.id}`);
                if(imgEl) {
                    imgEl.src = item.dataUrl;
                }
            } catch(e) { console.warn("Thumb render failed", e); }
            
            // Yield to avoid freezing on massive files
            if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
        }
    }

    document.getElementById('btn-pdf-clear').addEventListener('click', () => {
        savePdfToPdfState();
        state.pdfToPdf = [];
        renderGrid('pdfToPdf', pdfToPdfGrid, pdfToPdfActions);
    });
    
    document.getElementById('btn-pdf-delete-selected').addEventListener('click', () => {
        if(!confirm("Are you sure you want to delete the selected pages?")) return;
        savePdfToPdfState();
        state.pdfToPdf = state.pdfToPdf.filter(item => !item.selected);
        renderGrid('pdfToPdf', pdfToPdfGrid, pdfToPdfActions);
    });

    document.getElementById('btn-generate-pdf-to-pdf').addEventListener('click', async () => {
        const itemsToExport = state.pdfToPdf.some(i => i.selected) ? state.pdfToPdf.filter(i => i.selected) : state.pdfToPdf;
        if(itemsToExport.length === 0) return;
        
        const pwd = document.getElementById('pdf-password').value;
        if(pwd) {
            if(!/^\d{4}$/.test(pwd)) {
                alert("Password must be exactly 4 digits.");
                return;
            }
            generatePdf(itemsToExport, "Secure_PDF.pdf", pwd);
            return;
        }

        showLoading('Exporting PDF... (High Quality)');
        
        try {
            const { PDFDocument } = PDFLib;
            const finalDoc = await PDFDocument.create();
            
            // Cache loaded PDFLib documents to avoid parsing same file multiple times
            const loadedPdfDocs = {};
            
            for(let i = 0; i < itemsToExport.length; i++) {
                const item = itemsToExport[i];
                const compression = document.getElementById('pdf-compression').value;
                
                document.getElementById('loading-message').textContent = `Processing page ${i+1} of ${itemsToExport.length}...`;
                
                const isModified = item.crop || item.texts.length > 0 || item.filters.brightness !== 100 || item.filters.contrast !== 100 || item.filters.grayscale !== 0;
                
                if(!isModified && item.pdfInfo && compression !== 'low') {
                    // Lossless transfer
                    if(!loadedPdfDocs[item.pdfInfo.fileId]) {
                        loadedPdfDocs[item.pdfInfo.fileId] = await PDFDocument.load(pdfSourceCache[item.pdfInfo.fileId]);
                    }
                    const srcDoc = loadedPdfDocs[item.pdfInfo.fileId];
                    const [copiedPage] = await finalDoc.copyPages(srcDoc, [item.pdfInfo.pageIndex]);
                    finalDoc.addPage(copiedPage);
                } else {
                    // Fallback to image insertion (Modified or not a PDF source or low compression)
                    const dataUrl = await renderFinalImage(item);
                    const isPng = dataUrl.startsWith('data:image/png');
                    const imgBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
                    
                    let pdfImage;
                    if(isPng) pdfImage = await finalDoc.embedPng(imgBytes);
                    else pdfImage = await finalDoc.embedJpg(imgBytes);
                    
                    const page = finalDoc.addPage([pdfImage.width, pdfImage.height]);
                    page.drawImage(pdfImage, { x: 0, y: 0, width: pdfImage.width, height: pdfImage.height });
                }
                
                // Allow UI to update and prevent freezing on large documents
                if(i % 5 === 0) await new Promise(r => setTimeout(r, 0));
            }
            
            document.getElementById('loading-message').textContent = 'Saving PDF...';
            await new Promise(r => setTimeout(r, 50)); // UI paint
            
            const pdfBytes = await finalDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "Converted_Document.pdf";
            a.click();
            URL.revokeObjectURL(url);
        } catch(e) {
            console.error(e);
            alert("Error during export: " + e.message);
        }
        
        hideLoading();
    });

    // Enable drag and drop sorting for all grids using SortableJS
    const gridsToMakeSortable = [
        { key: 'imgToPdf', grid: imgToPdfGrid, actions: imgToPdfActions },
        { key: 'pdfToImg', grid: pdfToImgGrid, actions: pdfToImgActions },
        { key: 'createPdf', grid: createPdfGrid, actions: createPdfActions },
        { key: 'pdfToPdf', grid: pdfToPdfGrid, actions: pdfToPdfActions }
    ];

    gridsToMakeSortable.forEach(({ key, grid, actions }) => {
        new Sortable(grid, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            delay: 200,
            delayOnTouchOnly: true,
            onEnd: function (evt) {
                if(key === 'pdfToPdf') savePdfToPdfState();
                const item = state[key].splice(evt.oldIndex, 1)[0];
                state[key].splice(evt.newIndex, 0, item);
                renderGrid(key, grid, actions);
            }
        });
    });

    // Desktop Mouse Drag to Scroll for Tab Panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        let isDown = false;
        let startY;
        let scrollTop;
        let dragged = false;

        pane.addEventListener('mousedown', (e) => {
            dragged = false;
            if(e.target.closest('button, input, select, .item-overlay, .item-card')) return;
            isDown = true;
            pane.classList.add('active-drag');
            startY = e.pageY - pane.offsetTop;
            scrollTop = pane.scrollTop;
        });
        pane.addEventListener('mouseleave', () => {
            isDown = false;
            pane.classList.remove('active-drag');
        });
        pane.addEventListener('mouseup', () => {
            isDown = false;
            pane.classList.remove('active-drag');
        });
        pane.addEventListener('mousemove', (e) => {
            if(!isDown) return;
            e.preventDefault();
            dragged = true;
            const y = e.pageY - pane.offsetTop;
            const walk = (y - startY) * 1.5;
            pane.scrollTop = scrollTop - walk;
        });
        pane.addEventListener('click', (e) => {
            if(dragged) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
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
            const targetStateKey = replaceModal.dataset.targetState || 'createPdf';
            if (targetStateKey === 'pdfToPdf') savePdfToPdfState();
            
            state[targetStateKey].splice(replaceItemIndex, 1, ...newItems);
            
            let gridEl, actEl;
            if(targetStateKey === 'createPdf') { gridEl = createPdfGrid; actEl = createPdfActions; }
            if(targetStateKey === 'pdfToPdf') { gridEl = pdfToPdfGrid; actEl = pdfToPdfActions; }
            
            if(gridEl) renderGrid(targetStateKey, gridEl, actEl);
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
        
        // Show/hide delete selected button for pdfToPdf
        const btnDeleteSelected = document.getElementById('btn-pdf-delete-selected');
        if(btnDeleteSelected && stateKey === 'pdfToPdf') {
            const hasSelection = items.some(i => i.selected);
            if(hasSelection) btnDeleteSelected.classList.remove('hidden');
            else btnDeleteSelected.classList.add('hidden');
        }

        items.forEach((item, index) => {
            const col = document.createElement('div');
            col.className = 'item-card';
            if (item.selected) col.classList.add('selected');
            
            // Toggle selection on click or hold
            let holdTimer;
            col.addEventListener('pointerdown', (e) => {
                if (e.target.closest('.item-overlay') || e.target.closest('.btn-icon')) return;
                holdTimer = setTimeout(() => {
                    item.selected = !item.selected;
                    renderGrid(stateKey, gridEl, actionsEl);
                }, 400); // 400ms hold
            });
            col.addEventListener('pointerup', () => clearTimeout(holdTimer));
            col.addEventListener('pointerleave', () => clearTimeout(holdTimer));
            
            col.addEventListener('click', (e) => {
                if (e.target.closest('.item-overlay') || e.target.closest('.btn-icon')) return;
                item.selected = !item.selected;
                renderGrid(stateKey, gridEl, actionsEl);
            });
            
            // Generate a quick thumbnail applying filters structurally without canvas for speed, or canvas if crop exists
            // To be accurate, we'd render via canvas. For UI speed, we just use the raw image and CSS filters if no crop.
            
            col.innerHTML = `
                <div class="item-preview">
                    <img id="img-prev-${item.id}" src="${item.dataUrl}" style="filter: brightness(${item.filters.brightness}%) contrast(${item.filters.contrast}%) grayscale(${item.filters.grayscale}%)">
                    <div class="item-overlay">
                        <button class="btn-icon btn-move-left" title="Move Left" ${index === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}><i class="fa-solid fa-arrow-left"></i></button>
                        <button class="btn-icon btn-move-right" title="Move Right" ${index === items.length - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}><i class="fa-solid fa-arrow-right"></i></button>
                        <button class="btn-icon btn-rot-left" title="Rotate Left"><i class="fa-solid fa-rotate-left"></i></button>
                        <button class="btn-icon btn-rot-right" title="Rotate Right"><i class="fa-solid fa-rotate-right"></i></button>
                        <button class="btn-icon btn-edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon btn-save-pdf" title="Save this as PDF"><i class="fa-solid fa-file-pdf"></i></button>
                        ${(stateKey === 'createPdf' || stateKey === 'pdfToPdf') ? `<button class="btn-icon btn-replace" title="Replace"><i class="fa-solid fa-file-import"></i></button>` : ''}
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
                    if(stateKey === 'pdfToPdf') savePdfToPdfState();
                    const movedItem = state[stateKey].splice(index, 1)[0];
                    state[stateKey].splice(index - 1, 0, movedItem);
                    renderGrid(stateKey, gridEl, actionsEl);
                });
            }
            
            const btnMoveRight = col.querySelector('.btn-move-right');
            if(btnMoveRight && !btnMoveRight.disabled) {
                btnMoveRight.addEventListener('click', () => {
                    if(stateKey === 'pdfToPdf') savePdfToPdfState();
                    const movedItem = state[stateKey].splice(index, 1)[0];
                    state[stateKey].splice(index + 1, 0, movedItem);
                    renderGrid(stateKey, gridEl, actionsEl);
                });
            }

            col.querySelector('.btn-rot-left').addEventListener('click', async () => {
                if(stateKey === 'pdfToPdf') savePdfToPdfState();
                showLoading('Rotating...');
                await rotateItemImage(item, 'left');
                renderGrid(stateKey, gridEl, actionsEl);
                hideLoading();
            });
            col.querySelector('.btn-rot-right').addEventListener('click', async () => {
                if(stateKey === 'pdfToPdf') savePdfToPdfState();
                showLoading('Rotating...');
                await rotateItemImage(item, 'right');
                renderGrid(stateKey, gridEl, actionsEl);
                hideLoading();
            });
            col.querySelector('.btn-delete').addEventListener('click', () => {
                if(!confirm("Are you sure you want to remove this page?")) return;
                if(stateKey === 'pdfToPdf') savePdfToPdfState();
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

            if(stateKey === 'createPdf' || stateKey === 'pdfToPdf') {
                col.querySelector('.btn-replace').addEventListener('click', () => {
                    replaceItemIndex = index;
                    // For replace modal, we need to know which state key it's targeting
                    replaceModal.dataset.targetState = stateKey;
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
        else if(state.editor.activeTabState === 'pdfToPdf') { gridEl=pdfToPdfGrid; actEl=pdfToPdfActions; }
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

    async function generatePdf(itemArray, filename, password = null) {
        if(itemArray.length === 0) return;
        showLoading('Generating PDF...');
        
        const { jsPDF } = window.jspdf;
        const options = {};
        if (password) {
            options.encryption = {
                userPassword: password,
                ownerPassword: password,
                userPermissions: ["print", "copy"]
            };
        }
        const pdf = new jsPDF(options);
        
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
