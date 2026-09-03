# Provenance Metadata Schema

Every chunk stored in Vectorize carries this metadata:

| Field | Type | Description |
|---|---|---|
| `source` | string | Filename of the original document |
| `provenance` | string | `"human"` (original corpus) or `"generated"` (fed back from a model answer) |
| `gen_depth` | integer | 0 for original human content; increments by 1 each time a generated answer is re-ingested |
| `ingested_at` | ISO 8601 string | Timestamp when the chunk was added to the index |

## Example (human-authored chunk)
​```json
{
  "source": "network-security.txt",
  "provenance": "human",
  "gen_depth": 0,
  "ingested_at": "2026-09-03T13:35:00Z"
}
​```

## Example (generated chunk, after 1 contamination cycle)
​```json
{
  "source": "generated-answer-014.txt",
  "provenance": "generated",
  "gen_depth": 1,
  "ingested_at": "2026-09-10T10:12:00Z"
}
​```
