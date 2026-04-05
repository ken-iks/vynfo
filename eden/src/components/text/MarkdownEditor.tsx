import { Textarea } from "@/components/ui/textarea";

interface MarkdownEditorProps {
  value: string;
  onValueChange: (val: string) => void;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  return (
    <div className="flex flex-col border rounded-md flex-1">
      <h1 className="underline text-center"> Editor </h1>
      <Textarea
        value={props.value}
        onChange={(e) => props.onValueChange(e.target.value)}
        className="flex-1 border-0 rounded-none"
        placeholder="Write instructions..."
      />
    </div>
  );
}
