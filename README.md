# TDA Car Rental

TDA Car Rental is a TanStack Start application for managing vehicle rental operations.

## Development

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

## Quality checks

```sh
npm run test
npm run lint
npm run build
```

## Electron development

```sh
npm run electron:dev
```

## Windows installer

```sh
npm run dist:win
```

The packaged application stores documents in its Electron user-data SQLite
database. To bring forward documents from a previous browser-based version,
use **Data → Migrate legacy data…** and either search browser data or select a
SQLite backup file.
