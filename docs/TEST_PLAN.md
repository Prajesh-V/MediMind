# Test plan

## M0 checks

- Confirm no patient, prescription, food, dose, safety, interaction, or approved-rule seed exists.
- Validate the migration contains no `INSERT` statement and creates only medical-knowledge governance objects.
- Validate contract types with TypeScript once the project toolchain is initialized in M1.
- Confirm reference artifacts are preserved and their checksums are recorded.
- Confirm `.env.example` contains no secret values.

## Future mandatory coverage

- Unit tests for rule matching, temporal calculations, adherence, normalization, and tool schemas.
- Integration tests for source adapters, uploads, lifecycle transitions, and API authorization.
- Database RLS allow/deny tests for patient, connected professional, unrelated professional, and anonymous user.
- E2E patient and professional journeys from sign-in through authorized review.
