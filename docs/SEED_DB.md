# Seeding the Database

To populate the database with the default "Global" node and test data, run the following command in your terminal:

```bash
cd backend/api
npx prisma db seed
```

**Note:** Ensure you are using Node 22.11.0 (`nvm use 22.11.0`) before running this command.

If you encounter errors about `@prisma/client`, run:

```bash
npx prisma generate
npx prisma db seed
```

