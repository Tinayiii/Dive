# Host Activity Linkage

`src/data/host-profiles.json` contains the 50 supplied Host profiles. Its
`sourceId` is the CSV sequence number. `src/data/activities.json` identifies a
Host with a separate `host_id` value such as `user_8468`.

There is no shared key between the two datasets. Do not join them by array
position or activity ID: that would assign a real profile to an unrelated
activity.

The backend should own a mapping table with this shape before exposing Host
profiles on activity cards:

```json
{
  "activity_host_id": "user_8468",
  "host_profile_source_id": 12
}
```

Once supplied, the mapping should be validated as one-to-one for this seed
dataset and resolved server-side. The client should receive a single activity
payload with the approved public Host fields only.
