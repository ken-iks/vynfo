import { useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownViewer } from "./MarkdownViewer";

export function InstructionCard() {
  const [value, setValue] = useState("");

  return (
    <>
      <h1 className="w-1/3 mx-auto font-bold underline">
        {" "}
        Define Markdown Instructions For Vynfo Agent{" "}
      </h1>
      <div className="flex w-3/5 mx-auto h-128">
        <MarkdownEditor value={value} onValueChange={setValue} />
        <MarkdownViewer value={value} />
      </div>
    </>
  );
}
