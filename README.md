# Backend Asistencia (WebAuthn + PostgreSQL)

## Configuración
1) Copia `.env.example` a `.env` y edita:
   - DATABASE_URL (Neon/Postgres)
   - RP_ID (dominio de tu GitHub Pages: tuusuario.github.io)
   - EMPLOYEE_ORIGIN_FULL (URL del marcador)
   - ADMIN_ORIGIN_FULL (URL del admin)

2) Instala y ejecuta:
```bash
npm install
npm start
```

Endpoints:
- POST /register-begin
- POST /register-complete
- POST /auth-begin
- POST /auth-complete
- POST /mark
- GET  /marks
- GET  /stats
