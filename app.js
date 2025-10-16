// app.js

// --- LÓGICA DEL SERVICE WORKER (se queda igual) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => console.log('✅ Service Worker registrado'))
      .catch(error => console.error('❌ Error al registrar SW:', error));
  });
}

// --- LÓGICA DEL FORMULARIO Y LA BD (se queda igual) ---
const form = document.getElementById('task-form');
const taskList = document.getElementById('task-list');
const status = document.getElementById('status');

async function mostrarTareas() {
    try {
        const tareas = await obtenerTareas();
        taskList.innerHTML = '';
        tareas.forEach(tarea => {
            const li = document.createElement('li');
            li.textContent = tarea.title;
            taskList.appendChild(li);
        });
    } catch (error) {
        console.error('❌ Error al mostrar tareas:', error);
    }
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const titleInput = document.getElementById('task-title');
    if (!titleInput.value) return;

    await guardarTarea({ title: titleInput.value });
    form.reset();
    await mostrarTareas();

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        try {
            await registration.sync.register('sync-new-tasks');
            console.log('🔄 Sincronización registrada');
        } catch (err) {
            console.error('❌ No se pudo registrar la sincronización:', err);
        }
    }
});

function actualizarEstadoOnline() {
    status.style.display = navigator.onLine ? 'none' : 'block';
}

window.addEventListener('online', actualizarEstadoOnline);
window.addEventListener('offline', actualizarEstadoOnline);

// Carga inicial
actualizarEstadoOnline();
mostrarTareas();


// --- LÓGICA DE NOTIFICACIONES PUSH (VERSIÓN CORREGIDA) ---
const subscribeBtn = document.getElementById('subscribe-btn');

subscribeBtn.addEventListener('click', async () => {
    console.log('Botón de suscripción presionado.');

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.error('❌ Las notificaciones push no son soportadas.');
        alert('Las notificaciones push no son soportadas en este navegador.');
        return;
    }

    try {
        console.log('Solicitando permiso para notificaciones...');
        const permission = await Notification.requestPermission();
        
        if (permission !== 'granted') {
            console.warn('⚠️ Permiso para notificaciones no concedido.');
            alert('No has dado permiso para recibir notificaciones.');
            return;
        }

        console.log('Permiso concedido. Obteniendo suscripción...');
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: 'BHiq36BCHwO661mxFW4dpu1gtENZyYC7uhn9-87GOtluu8J0iWP7Gud2Lo2wVYzWSRsctkmnf-wNFfMv5EbMYQM' // Clave pública VAPID
        });

        console.log('✅ Suscripción Push generada:');
        console.log(JSON.stringify(subscription));

        // Aquí enviarías la 'subscription' a tu servidor
        alert('¡Suscrito a notificaciones con éxito!');

    } catch (error) {
        console.error('❌ Error durante el proceso de suscripción:', error);
        alert('Ocurrió un error al intentar suscribirse a las notificaciones.');
    }
});