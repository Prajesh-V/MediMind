# Migration structure

Name every migration `YYYYMMDDHHMMSS_description.sql` in UTC. Add a new migration for every schema change; do not rewrite an applied file.

The M0 migration creates private shared-medical-knowledge and rule-governance structures only. It intentionally contains no patient records, no production data, and no approved rules.
