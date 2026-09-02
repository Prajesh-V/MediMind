# Next.js Webpack Cache Fix

## DEVELOPMENT ENVIRONMENT NOTE

If Next.js reports React Client Manifest / SegmentViewNode /
__webpack_modules__[moduleId] errors during `next dev`:

1. Stop the dev server.
2. Delete `.next`.
3. Restart `npm run dev`.
4. Re-test the affected route.
5. Do NOT modify application architecture or dependencies unless the error survives a clean `.next` rebuild.
6. Confirm with `npm run build` + `npm start` before treating it as an application defect.

Known environment:
- Next.js 15.5.25
- React 19.2.8
- React-DOM 19.2.8
- Node 26.4.0
- Webpack dev bundler
