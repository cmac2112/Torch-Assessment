# assessment/

The application. Full documentation — architecture, data flow, tradeoffs, and known gaps — is in the
[repository README](../README.md).

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

Requires Node.js 20+. There is no backend to start — `api/mockApi.ts` stands in for one, including
simulated latency and intermittent failures. To disable the simulated failures while reviewing, set
`FAILURE_RATE = 0` at the top of that file.

Stack: React 19, TypeScript, Vite 8, `react-window` for virtualization. No UI framework.
