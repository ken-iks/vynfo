interface MarkdownEditorProps {
  value: string;
  onValueChange: (val: string) => void;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  return (
    <div className="flex flex-col border rounded-md flex-1">
      <h1 className="underline text-center"> Editor </h1>
      <textarea
        value={props.value}
        onChange={(e) => props.onValueChange(e.target.value)}
        className="w-full flex-1 outline-none p-1"
        placeholder="Write instructions..."
      />
    </div>
  );
}
