import "tsconfig-paths/register";
import "dotenv/config";

import { createAdminServer } from "./server";

const server = createAdminServer();
void server.start();
