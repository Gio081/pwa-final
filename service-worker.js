const CACHE_STATIC_NAME = 'static-v4'; 
const CACHE_DYNAMIC_NAME = 'dynamic-v3';
const CACHE_INMUTABLE_NAME = 'inmutable-v1';

const APP_SHELL = [
    './',
    './index.html',
    './app.js',
    './db.js',
    './style.css', 
    './offline.html',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

const APP_SHELL_INMUTABLE = [
    'https://cdn.jsdelivr.net/npm/idb@8/build/umd.js'
];

// --- EVENTO INSTALL ---
self.addEventListener('install', event => {
    const cacheStatic = caches.open(CACHE_STATIC_NAME).then(cache => cache.addAll(APP_SHELL));
    const cacheInmutable = caches.open(CACHE_INMUTABLE_NAME).then(cache => cache.addAll(APP_SHELL_INMUTABLE));
    event.waitUntil(Promise.all([cacheStatic, cacheInmutable]));
});

// --- EVENTO ACTIVATE ---
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_STATIC_NAME && key !== CACHE_INMUTABLE_NAME && key !== CACHE_DYNAMIC_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
});

// --- EVENTO FETCH ---
self.addEventListener('fetch', event => {
    // --- ESTRATEGIAS DE CACHEO ---

    // 1. Estrategia: Stale-While-Revalidate
    // Ideal para archivos que queremos que se carguen rápido, pero que se actualicen en segundo plano.
    // Usaremos esto para nuestro archivo de estilos CSS.
    if (event.request.url.includes('style.css')) {
        event.respondWith(
            caches.open(CACHE_STATIC_NAME).then(cache => {
                return cache.match(event.request).then(cacheRes => {
                    const fetchPromise = fetch(event.request).then(networkRes => {
                        cache.put(event.request, networkRes.clone());
                        return networkRes;
                    });
                    // Devolvemos la respuesta de la caché (rápido), mientras la red actualiza por detrás.
                    return cacheRes || fetchPromise;
                });
            })
        );
    } 
    
    // 2. Estrategia: Network-First
    // Para datos que necesitan estar lo más actualizados posible, como peticiones a una API.
    // Lo aplicaremos a la API de prueba de jsonplaceholder.
    else if (event.request.url.includes('jsonplaceholder.typicode.com')) {
        event.respondWith(
            fetch(event.request).then(networkRes => {
                // Si la red funciona, guardamos en caché dinámica y devolvemos la respuesta.
                return caches.open(CACHE_DYNAMIC_NAME).then(cache => {
                    cache.put(event.request, networkRes.clone());
                    return networkRes;
                });
            }).catch(() => {
                // Si la red falla, buscamos en la caché como respaldo.
                return caches.match(event.request);
            })
        );
    } 
    
    // 3. Estrategia: Cache-First (con fallback a Network)
    // Para todo el resto de nuestro App Shell. Sirve desde la caché y si no lo encuentra, va a la red.
    else {
        event.respondWith(
            caches.match(event.request).then(cacheRes => {
                return cacheRes || fetch(event.request).then(networkRes => {
                    return caches.open(CACHE_DYNAMIC_NAME).then(cache => {
                        cache.put(event.request, networkRes.clone());
                        return networkRes;
                    });
                }).catch(() => {
                    // Si todo falla, mostramos la página offline.
                    if (event.request.mode === 'navigate') {
                        return caches.match('./offline.html');
                    }
                });
            })
        );
    }
});

// --- EVENTO SYNC: Se activa cuando vuelve la conexión a internet ---
self.addEventListener('sync', event => {
    console.log('Service Worker: Sincronización en segundo plano recibida', event);
    if (event.tag === 'sync-new-tasks') {
        event.waitUntil(sincronizarTareas());
    }
});

async function sincronizarTareas() {
    // Importamos la librería idb para poder usarla dentro del Service Worker
    importScripts('https://cdn.jsdelivr.net/npm/idb@8/build/umd.js');
    
    const dbPromise = idb.openDB('tareas-db', 1);
    const db = await dbPromise;
    const tareas = await db.getAll('tareas');

    // Intentamos enviar cada tarea guardada al servidor
    for (const tarea of tareas) {
        try {
            const response = await fetch('https://jsonplaceholder.typicode.com/posts', { // API de prueba
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tarea),
            });

            if (response.ok) {
                console.log('Tarea enviada al servidor:', tarea);
                // Si el envío es exitoso, la eliminamos de IndexedDB
                await db.delete('tareas', tarea.id);
            }
        } catch (err) {
            console.error('Error al enviar la tarea. Se reintentará más tarde.', err);
        }
    }
}

// --- EVENTO PUSH: Se activa cuando llega una notificación del servidor ---
self.addEventListener('push', event => {
    console.log('Service Worker: Notificación Push recibida');

    const data = event.data.json(); // Suponemos que el servidor envía datos en formato JSON
    const title = data.title;
    const options = {
        body: data.body,
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-192x192.png' // Ícono para la barra de notificaciones en Android
    };

    event.waitUntil(self.registration.showNotification(title, options));
});