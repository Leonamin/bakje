import { useEffect, useState } from "react";
import { Button } from "../basic/button";
import { TextField } from "../basic/text-field";
import { Select } from "../overlays/select";

export type FilterValues = { query: string; status: string };
export function SearchFilterBar({
  value,
  onApply,
  statusOptions = [
    { value: "all", label: "전체" },
    { value: "active", label: "활성" },
    { value: "draft", label: "초안" },
  ],
}: {
  value: FilterValues;
  onApply: (value: FilterValues) => void;
  statusOptions?: { value: string; label: string }[];
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value.query, value.status]);
  return (
    <div>
      <form
        className="gc-filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft);
        }}
      >
        <TextField
          label="검색"
          value={draft.query}
          onChange={(e) => setDraft({ ...draft, query: e.target.value })}
          placeholder="검색어 입력"
        />
        <Select
          label="상태"
          value={draft.status}
          onValueChange={(status) => setDraft({ ...draft, status })}
          options={statusOptions}
        />
        <Button variant="primary" type="submit">
          적용
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={() => {
            const empty = { query: "", status: statusOptions[0]?.value || "" };
            setDraft(empty);
            onApply(empty);
          }}
        >
          초기화
        </Button>
      </form>
      <p className="gc-muted">
        적용된 조건: {value.query || "검색어 없음"} ·{" "}
        {statusOptions.find((option) => option.value === value.status)?.label ||
          value.status}
      </p>
    </div>
  );
}
