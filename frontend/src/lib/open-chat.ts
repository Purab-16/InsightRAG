import { api } from "@/lib/api";

/** Id of the latest chat with exactly these papers, creating one if there is none yet. */
export async function chatIdFor(paperIds: string[]): Promise<string> {
  const key = [...paperIds].sort().join(",");
  const all = await api.listSessions();
  const found = all.find((s) => [...s.paper_ids].sort().join(",") === key);
  return found ? found.id : (await api.createSession(paperIds)).id;
}
