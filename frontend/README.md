# Kenzo Pawsitive Academy 🐾

A coaching app for dogs, built with React + Vite against the `coaching` API.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Roles
- **Pup (STUDENT)** – browse/filter courses (trainer, room, day), pick seats cinema-style, see bookings.
- **Trainer (TEACHER)** – Studio: create courses, see own classes.
- **Head Dog (ADMIN)** – approve/reject pending signups, add trainers, pups, courses and classrooms.

## API & CORS
In dev, requests go to `/api`, which Vite proxies to the API Gateway (`vite.config.js`).
The deployed API only sends `Access-Control-Allow-Origin` on OPTIONS preflights, not on real
GET/POST responses, so a production build calling it directly will be blocked by browsers until the
Lambdas return CORS headers (or you serve the app behind a same-origin proxy/CloudFront behaviour).
Set `VITE_API_BASE` to override the base URL.
