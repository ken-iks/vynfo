import { OpenSpaceRequestSchema } from "@/gen/proto/v1/spaces_pb";
import { spacesClient } from "@/lib/client";
import { create } from "@bufbuild/protobuf";

/**
 * The spaceWorker handles alerting an open space to when a new
 * message has been sent to the group chat whilst they have it open
 *
 * This allows the client to trigger a rerender in order to get the latest
 * message
 */
export type SpaceWorkerInput = {
  userId: string;
  spaceId: string;
};

self.onmessage = async (event: MessageEvent<SpaceWorkerInput>) => {
  const { userId, spaceId } = event.data;
  const req = create(OpenSpaceRequestSchema, { userId, spaceId });
  for await (const response of spacesClient.openSpace(req)) {
    if (response.newMessageAlert.valueOf()) {
      self.postMessage({ kind: "reload" });
    }
  }
};

export function instantiateSpaceWorker(input: SpaceWorkerInput): Worker {
  const worker = new Worker(new URL("./spaceWorker.ts", import.meta.url), {
    type: "module",
  });
  worker.postMessage(input);
  return worker;
}
