import { db } from "./db";
export function assertStorageUnlocked(storageId: number) {
  const lock = db().prepare("SELECT plan_id FROM library_storage_lock WHERE storage_id=?").get(storageId) as { plan_id: number } | undefined;
  if (lock) throw new Error(`이 저장소는 원본 정리 작업 #${lock.plan_id}을 처리 중입니다. 완료하거나 되돌린 뒤 수정하세요.`);
}
