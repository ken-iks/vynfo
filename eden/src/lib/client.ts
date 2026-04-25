import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { ProjectService } from "../gen/proto/v1/projects_pb";
import { SpacesService } from "../gen/proto/v1/spaces_pb";
import { UsersService } from "../gen/proto/v1/users_pb";

const transport = createConnectTransport({
  baseUrl: "http://localhost:8080",
});

export const client = createClient(ProjectService, transport);
export const spacesClient = createClient(SpacesService, transport);
export const usersClient = createClient(UsersService, transport);
