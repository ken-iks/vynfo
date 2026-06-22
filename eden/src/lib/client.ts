import { createClient, type Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { ProjectService } from "../gen/proto/v1/projects_pb";
import { SpacesService } from "../gen/proto/v1/spaces_pb";
import { UsersService } from "../gen/proto/v1/users_pb";
import { FileService } from "../gen/proto/v1/vfs_pb";
import { WorkspacesService } from "../gen/proto/v1/workspaces_pb";
import { auth } from "@/firebase";
import { ConversationService } from "@/gen/proto/v1/conversation_pb";

const baseUrl = import.meta.env.DEV ? "http://localhost:8080" : "/api";
// Firebase Hosting rewrites buffer streamed responses, so agent streaming calls
// use the Cloud Run service directly in production instead of the /api proxy.
const streamingBaseUrl = import.meta.env.DEV
  ? baseUrl
  : import.meta.env.VITE_CHICHI_STREAMING_BASE_URL;

if (!streamingBaseUrl) {
  throw new Error("missing VITE_CHICHI_STREAMING_BASE_URL");
}

async function getCurrentIdToken() {
  const user = auth.currentUser;
  if (!user) return "";
  return user.getIdToken();
}

function authInterceptor(getToken: () => Promise<string>): Interceptor {
  return (next) => async (req) => {
    const token = await getToken();
    if (token) {
      req.header.set("Authorization", `Bearer ${token}`);
    }
    return next(req);
  };
}

const transport = createConnectTransport({
  baseUrl,
  interceptors: [authInterceptor(getCurrentIdToken)],
});

const streamingTransport = createConnectTransport({
  baseUrl: streamingBaseUrl,
  interceptors: [authInterceptor(getCurrentIdToken)],
});

export const client = createClient(ProjectService, transport);
export const spacesClient = createClient(SpacesService, transport);
export const usersClient = createClient(UsersService, transport);
export const filesClient = createClient(FileService, transport);
export const workspacesClient = createClient(WorkspacesService, transport);
export const conversationClient = createClient(ConversationService, transport);
export const conversationStreamingClient = createClient(
  ConversationService,
  streamingTransport,
);

export function createSpacesClient(idToken: string) {
  // Web workers do not share the main thread Firebase auth instance, so the
  // open-space worker gets a token from React code and builds its own client.
  const workerTransport = createConnectTransport({
    baseUrl,
    interceptors: [authInterceptor(async () => idToken)],
  });
  return createClient(SpacesService, workerTransport);
}
