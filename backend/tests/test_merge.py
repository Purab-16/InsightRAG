"""Guest-to-account merge: logic against an in-memory fake database, plus the endpoint's guard rules."""

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from postgrest import APIError as PostgrestError

from app import merge
from app.errors import AppError
from app.main import app

GUEST = "11111111-1111-1111-1111-111111111111"
ACCOUNT = "22222222-2222-2222-2222-222222222222"
ARXIV_A = "aaaaaaaa-0000-0000-0000-00000000000a"
ARXIV_B = "bbbbbbbb-0000-0000-0000-00000000000b"
UP_GUEST = "cccccccc-0000-0000-0000-00000000000c"
UP_TWIN = "dddddddd-0000-0000-0000-00000000000d"


class Result:
    def __init__(self, data):
        self.data = data


class Query:
    def __init__(self, db, name):
        self.db, self.name = db, name
        self.filters, self.op, self.payload, self.keys = [], "select", None, None

    def select(self, *_a, **_k):
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def update(self, payload):
        self.op, self.payload = "update", payload
        return self

    def upsert(self, payload, on_conflict=None, ignore_duplicates=False):
        self.op, self.payload, self.keys = "upsert", payload, (on_conflict or "").split(",")
        return self

    def execute(self):
        rows = self.db.tables[self.name]
        match = [r for r in rows if all(r.get(k) == v for k, v in self.filters)]
        if self.op == "select":
            return Result([dict(r) for r in match])
        if self.op == "update":
            for r in match:
                new_owner = self.payload.get("uploaded_by")
                if self.name == "papers" and new_owner and any(
                    o is not r and o["source"] == "upload" and o["uploaded_by"] == new_owner
                    and o["content_hash"] == r["content_hash"]
                    for o in rows
                ):
                    raise PostgrestError({"message": "duplicate", "code": "23505", "details": "", "hint": ""})
                r.update(self.payload)
            return Result([dict(r) for r in match])
        if not any(all(r[k] == self.payload[k] for k in self.keys) for r in rows):
            rows.append(dict(self.payload))
        return Result([])


class Bucket:
    def __init__(self, files):
        self.files = files

    def move(self, src, dst):
        if src not in self.files:
            raise RuntimeError("Object not found")
        self.files.remove(src)
        self.files.add(dst)

    def exists(self, path):
        return path in self.files


class FakeDb:
    def __init__(self, files=None):
        self.tables = {
            "papers": [
                {"id": ARXIV_A, "source": "arxiv", "uploaded_by": None, "content_hash": None},
                {"id": ARXIV_B, "source": "arxiv", "uploaded_by": None, "content_hash": None},
                {"id": UP_GUEST, "source": "upload", "uploaded_by": GUEST, "content_hash": "h1"},
            ],
            "user_papers": [
                {"user_id": GUEST, "paper_id": ARXIV_A, "added_at": "2026-11-01T01:00:00+00:00"},
                {"user_id": GUEST, "paper_id": UP_GUEST, "added_at": "2026-11-01T02:00:00+00:00"},
                {"user_id": ACCOUNT, "paper_id": ARXIV_B, "added_at": "2026-10-30T00:00:00+00:00"},
            ],
            "chat_sessions": [{"id": "s1", "user_id": GUEST, "paper_ids": [ARXIV_A, UP_GUEST]}],
        }
        self.files = {f"{GUEST}/{UP_GUEST}.pdf"} if files is None else files
        self.storage = SimpleNamespace(from_=lambda _bucket: Bucket(self.files))

    def table(self, name):
        return Query(self, name)

    def library(self, user):
        return {r["paper_id"] for r in self.tables["user_papers"] if r["user_id"] == user}


def run_merge(db):
    with patch.object(merge, "get_db", return_value=db):
        return merge.merge_guest_into_account(GUEST, ACCOUNT)


class MergeLogic(unittest.TestCase):
    def test_copies_library_moves_uploads_and_chats(self):
        db = FakeDb()
        result = run_merge(db)

        self.assertEqual((result.papers_copied, result.uploads_moved, result.chats_moved), (2, 1, 1))
        self.assertEqual(db.library(ACCOUNT), {ARXIV_A, ARXIV_B, UP_GUEST})
        self.assertEqual(db.library(GUEST), {ARXIV_A, UP_GUEST}, "the guest's own library is left alone")
        upload = next(p for p in db.tables["papers"] if p["id"] == UP_GUEST)
        self.assertEqual(upload["uploaded_by"], ACCOUNT)
        self.assertEqual(db.files, {f"{ACCOUNT}/{UP_GUEST}.pdf"})
        self.assertEqual(db.tables["chat_sessions"][0]["user_id"], ACCOUNT)
        added = next(r for r in db.tables["user_papers"] if r["user_id"] == ACCOUNT and r["paper_id"] == ARXIV_A)
        self.assertEqual(added["added_at"], "2026-11-01T01:00:00+00:00", "keeps the original date")

    def test_running_it_twice_changes_nothing_more(self):
        db = FakeDb()
        run_merge(db)
        rows_after_first = [dict(r) for r in db.tables["user_papers"]]
        second = run_merge(db)

        self.assertEqual((second.papers_copied, second.uploads_moved, second.chats_moved), (0, 0, 0))
        self.assertEqual(db.tables["user_papers"], rows_after_first)

    def test_same_pdf_already_on_the_account_is_reused(self):
        db = FakeDb()
        db.tables["papers"].append({"id": UP_TWIN, "source": "upload", "uploaded_by": ACCOUNT, "content_hash": "h1"})
        db.tables["user_papers"].append({"user_id": ACCOUNT, "paper_id": UP_TWIN, "added_at": "2026-10-01T00:00:00+00:00"})
        result = run_merge(db)

        self.assertEqual(result.uploads_moved, 0)
        self.assertNotIn(UP_GUEST, db.library(ACCOUNT))
        self.assertEqual(db.tables["chat_sessions"][0]["paper_ids"], [ARXIV_A, UP_TWIN], "chat points at the account's copy")
        self.assertEqual(sum(1 for r in db.tables["user_papers"] if r["user_id"] == ACCOUNT and r["paper_id"] == UP_TWIN), 1)

    def test_a_missing_file_does_not_stop_the_merge(self):
        db = FakeDb(files=set())
        result = run_merge(db)

        self.assertEqual(result.uploads_moved, 0)
        self.assertEqual(result.chats_moved, 1)
        self.assertIn(ARXIV_A, db.library(ACCOUNT))
        upload = next(p for p in db.tables["papers"] if p["id"] == UP_GUEST)
        self.assertEqual(upload["uploaded_by"], GUEST, "stays with the guest so a later run can retry")


def user(user_id, anonymous):
    return SimpleNamespace(id=user_id, is_anonymous=anonymous)


class MergeEndpoint(unittest.TestCase):
    URL = "/api/me/merge-guest"
    BODY = {"guest_token": "g" * 40}

    def call(self, tokens, headers=None):
        """tokens maps a token string to a user, or to an AppError to raise."""

        def fake_verify(token):
            found = tokens[token]
            if isinstance(found, AppError):
                raise found
            return found

        client = TestClient(app, raise_server_exceptions=False)
        headers = {"Authorization": "Bearer account-token"} if headers is None else headers
        with patch("app.auth.verify_token", fake_verify), patch("app.routers.me.verify_token", fake_verify), patch(
            "app.routers.me.merge_guest_into_account"
        ) as merged:
            merged.return_value = {"papers_copied": 1, "uploads_moved": 0, "chats_moved": 2}
            res = client.post(self.URL, json=self.BODY, headers=headers)
        return res, merged

    def test_account_plus_guest_is_merged(self):
        res, merged = self.call({"account-token": user(ACCOUNT, False), "g" * 40: user(GUEST, True)})
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json(), {"papers_copied": 1, "uploads_moved": 0, "chats_moved": 2})
        merged.assert_called_once()

    def test_needs_the_account_token(self):
        res, merged = self.call({}, headers={})
        self.assertEqual(res.status_code, 401)
        merged.assert_not_called()

    def test_target_must_not_be_a_guest(self):
        res, merged = self.call({"account-token": user(ACCOUNT, True), "g" * 40: user(GUEST, True)})
        self.assertEqual(res.status_code, 400)
        merged.assert_not_called()

    def test_source_must_be_a_guest(self):
        res, merged = self.call({"account-token": user(ACCOUNT, False), "g" * 40: user(GUEST, False)})
        self.assertEqual(res.status_code, 400, "two real accounts can never be merged")
        merged.assert_not_called()

    def test_cannot_merge_into_itself(self):
        res, merged = self.call({"account-token": user(ACCOUNT, False), "g" * 40: user(ACCOUNT, True)})
        self.assertEqual(res.status_code, 400)
        merged.assert_not_called()

    def test_bad_or_expired_guest_token(self):
        res, merged = self.call(
            {"account-token": user(ACCOUNT, False), "g" * 40: AppError("unauthorized", "Invalid or expired token.")}
        )
        self.assertEqual(res.status_code, 401)
        merged.assert_not_called()


if __name__ == "__main__":
    unittest.main()
