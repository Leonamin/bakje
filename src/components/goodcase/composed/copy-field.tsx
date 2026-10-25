import { useRef, useState } from "react";
import { Button } from "../basic/button";
import { TextField } from "../basic/text-field";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [message, setMessage] = useState("");
  const [isCopying, setIsCopying] = useState(false);
  const isCopyingRef = useRef(false);
  async function copy() {
    if (isCopyingRef.current) return;
    isCopyingRef.current = true;
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(value);
      setMessage("복사했습니다.");
    } catch {
      setMessage("복사하지 못했습니다. 텍스트를 직접 선택해 복사하세요.");
    } finally {
      isCopyingRef.current = false;
      setIsCopying(false);
    }
  }
  return (
    <div className="gc-copy-field">
      <TextField label={label} value={value} readOnly />
      <Button variant="secondary" onClick={copy} disabled={isCopying}>
        {isCopying ? "복사 중…" : "복사"}
      </Button>
      <p role="status">{message}</p>
    </div>
  );
}
