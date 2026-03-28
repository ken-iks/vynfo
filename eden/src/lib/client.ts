import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { VideoService } from "../gen/proto/v1/api_pb";

const transport = createConnectTransport({
  baseUrl: "http://localhost:8080",
});

export const client = createClient(VideoService, transport);
