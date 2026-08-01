# Torch-Assessment
assessment repo

# Roadmap 
whats in scope:

Virtualized list, filters, debounced search, modal popup with more details on click of a row. Should support at least 1,000,000 rows smoothly

## Virtualized list vs pagination
The descision for using a virtualzed list instead of pagination comes soley from a user experience persepective. Forcing useres to click next and back on pages of only 25 or so 
is tedious from a UX perspective, having an infinite scroll would make a better user experience overall. However, we will have to batch our virtualization requests in groups similarly to pagination but still giving the effect of an infinite scroll

## State management
Handling loading state, data state, and error state seperately in their own `useStates` allows for different types of states to occur unintentionally. This application should use a `useReducer` to manage state
properly. This makes more sense than 3 seperate state variables because instead of manually setting each one, you can dispatch events to the reducer to perform state updates for you and guarantee the type of state 
you expect out of it based on the type of dispatch you perform.

## Mock api
This application uses a mock api `/api/mockApi.ts` this was chosen to reduce scope and complexity of this assessment. If required this could be migrated to support any server (asp.net, springboot, flask, etc.) fairly quickly with
some setup.


## Project structure
```
assessment/
├── api/
│   └── mockApi.ts        # Mock data/API layer standing in for a real backend
├── public/                # Static assets (favicon, icon sprite)
├── src/
│   ├── Home/
│   │   ├── Components/    # Home-page subcomponents (virtualized list, filters, modal, etc.)
│   │   ├── Home.tsx       # Home screen: fetches data, manages reducer state
│   │   └── Home.css
│   ├── index.css
│   └── main.tsx           # App entry point
├── index.html
├── vite.config.ts
├── tsconfig*.json
├── eslint.config.js
└── package.json
```

## Getting started
Requires Node.js 20+ and npm.

```bash
cd assessment
npm install
npm run dev
```
This starts the Vite dev server (default: http://localhost:5173).

Other scripts:
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint
