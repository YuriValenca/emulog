// public/service-worker.js
self.addEventListener('install', event => {
  console.log('Service Worker installing.');
  event.waitUntil(self.skipWaiting()); // Força a instalação do service worker
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating.');
  event.waitUntil(self.clients.claim()); // Força a ativação imediata do service worker
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-projects') {
    event.waitUntil(syncProjects());
  }
});

async function syncProjects() {
  try {
    const response = await fetch('/sync-projects');
    const projects = await response.json();

    for (const project of projects) {
      await fetch('/api/save-project', {
        method: 'POST',
        body: JSON.stringify(project),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('Projetos sincronizados com sucesso.');
  } catch (error) {
    console.error('Erro ao sincronizar projetos:', error);
  }
}
