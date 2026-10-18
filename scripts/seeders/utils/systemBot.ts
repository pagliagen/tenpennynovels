// ID fisso e riconoscibile (non un ObjectId "casuale" generato al momento): permette di
// impostare SYSTEM_BOT_USER_ID una volta sola nell'env, uguale su ogni ambiente seedato
// con questi script, invece di doverlo rileggere dal DB ogni volta.
// Vive qui e non in UserSeeder.ts perché importare un seeder ne esegue il main().
export const SYSTEM_BOT_USER_ID = '000000000000000000000001';
