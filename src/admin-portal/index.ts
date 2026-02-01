import "tsconfig-paths/register";
import "dotenv/config";

import { createAdminServer } from "@/admin-portal/server";

const server = createAdminServer();
void server.start();
