import Markdown from "react-markdown";

interface MarkdownViewerProps {
  value: string;
}

export function MarkdownViewer(props: MarkdownViewerProps) {
  return (
    <div className="border rounded-md p4 flex-1">
      <h1 className="underline text-center"> Viewer </h1>
      <div className="prose p-1">
        <Markdown>{props.value}</Markdown>
      </div>
    </div>
  );
}
