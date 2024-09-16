const video = document.getElementById('inputVideo');
const canvas = document.getElementById('overlay');

// Solicitar acceso a la cámara y configurar el video
(async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        // Asegurarnos de que el video esté listo antes de proceder
        video.addEventListener('loadedmetadata', () => {
            console.log('Video cargado, comenzando detecciones...');
            onPlay();  // Comenzar las detecciones cuando el video esté listo
        });
    } catch (error) {
        console.error("Error al acceder a la cámara: ", error);
    }
})();

async function onPlay() {
    const MODEL_URL = '/public/models';

    // Cargar los modelos necesarios de face-api.js
    try {
        await faceapi.loadSsdMobilenetv1Model(MODEL_URL);
        await faceapi.loadFaceLandmarkModel(MODEL_URL);
        await faceapi.loadFaceRecognitionModel(MODEL_URL);
        await faceapi.loadFaceExpressionModel(MODEL_URL);
        console.log("Modelos cargados correctamente");
    } catch (error) {
        console.error("Error al cargar los modelos: ", error);
        return;
    }

    // Establecer las dimensiones del canvas para que coincidan con el video
    const displaySize = { width: video.videoWidth, height: video.videoHeight }; // Asegurarse de usar `videoWidth` y `videoHeight`
    faceapi.matchDimensions(canvas, displaySize); // Ajustar las dimensiones del canvas

    // Cargar imágenes de referencia y crear un FaceMatcher
    const labeledFaceDescriptors = await loadLabeledImages();
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

    // Bucle continuo para detectar rostros en el video
    setInterval(async () => {
        // Detectar rostros en el video en tiempo real
        const fullFaceDescriptions = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options())
            .withFaceLandmarks()
            .withFaceDescriptors();

        const resizedResults = faceapi.resizeResults(fullFaceDescriptions, displaySize);

        // Limpiar el canvas antes de dibujar los nuevos resultados
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Dibujar detecciones de los rostros y puntos de referencia
        faceapi.draw.drawDetections(canvas, resizedResults);
        faceapi.draw.drawFaceLandmarks(canvas, resizedResults);

        // Comparar los descriptores detectados con los descriptores de referencia
        const results = resizedResults.map(d => faceMatcher.findBestMatch(d.descriptor));

        // Mostrar el nombre de la persona reconocida en el video
        results.forEach((result, i) => {
            const box = resizedResults[i].detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
            drawBox.draw(canvas);
        });

    }, 100); // Repetir cada 100ms para detección en tiempo real
}

// Función para cargar imágenes de referencia desde la carpeta 'imagenes'
async function loadLabeledImages() {
    const labels = ['hector', 'giuliana']; // Nombres de las personas (debe coincidir con los nombres de las carpetas)
    
    return Promise.all(
        labels.map(async label => {
            const descriptions = [];
            for (let i = 1; i <= 1; i++) { // Número de imágenes por persona
                const img = await faceapi.fetchImage(`/imagenes/${label}/${i}.png`);
                const detections = await faceapi.detectSingleFace(img)
                    .withFaceLandmarks()
                    .withFaceDescriptor(); // Obtener descriptores faciales
                if (!detections) {
                    console.error(`No se detectó ningún rostro en la imagen: ${label}/${i}.png`);
                } else {
                    descriptions.push(detections.descriptor); // Guardar descriptores
                }
            }
            return new faceapi.LabeledFaceDescriptors(label, descriptions); // Retornar descriptores etiquetados
        })
    );
}
