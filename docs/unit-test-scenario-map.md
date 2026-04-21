# Unit Test Scenario Map

This document maps each core backend scenario to at least one successful path and one failing or rejected path. The automated tests live inside each Django app's `tests.py` file.

## Accounts

Scenario: authenticated user identity lookup
Passing case:
- `accounts.tests.AccountApiTests.test_me_endpoint_syncs_role_when_organization_profile_exists`

Failing or rejected case:
- `accounts.tests.AccountApiTests.test_me_endpoint_requires_authentication`

## Organizations

Scenario: create an organization profile
Passing case:
- `organizations.tests.OrganizationApiTests.test_create_profile_promotes_user_and_defaults_contact_email`

Failing or rejected case:
- `organizations.tests.OrganizationApiTests.test_duplicate_profile_creation_is_rejected`

Scenario: public organization profile access
Passing case:
- `organizations.tests.OrganizationApiTests.test_public_can_view_organization_and_its_animals`

Failing or rejected case:
- `organizations.tests.OrganizationApiTests.test_public_organization_lookup_returns_404_for_missing_profile`

## Animals

Scenario: organization creates an animal profile for a rescue case
Passing case:
- `animals.tests.AnimalApiTests.test_organization_can_create_animal_for_own_case_and_case_moves_to_adoption`

Failing or rejected case:
- `animals.tests.AnimalApiTests.test_organization_cannot_create_animal_for_another_organizations_case`

Scenario: public animal browsing by organization
Passing case:
- `animals.tests.AnimalApiTests.test_public_feed_can_filter_animals_by_organization`

Failing or rejected case:
- `animals.tests.AnimalApiTests.test_public_filter_returns_empty_list_for_unknown_organization`

## Posts

Scenario: organization publishes an update for one of its animals
Passing case:
- `posts.tests.PostApiTests.test_organization_can_create_post_for_own_animal`

Failing or rejected case:
- `posts.tests.PostApiTests.test_organization_cannot_create_post_for_another_organizations_animal`

Scenario: public feed reads published updates
Passing case:
- `posts.tests.PostApiTests.test_public_feed_returns_published_posts`

Failing or rejected case:
- `posts.tests.PostApiTests.test_by_animal_returns_empty_list_for_unknown_animal`

## Rescue

Scenario: public user submits a stray animal report
Passing case:
- `rescue.tests.RescueApiTests.test_report_case_creates_new_case_and_report`

Failing or rejected case:
- `rescue.tests.RescueApiTests.test_report_case_requires_image`

Scenario: organization accepts and manages a case
Passing case:
- `rescue.tests.RescueApiTests.test_organization_can_accept_unassigned_case`

Failing or rejected case:
- `rescue.tests.RescueApiTests.test_invalid_case_status_update_is_rejected`

## Test Execution

Use the dedicated test settings module so the suite runs on SQLite and does not depend on the development PostgreSQL database:

```powershell
cd backend/StrayAid_backend
& 'g:\first PC\BSSE\FYP\.venv\Scripts\python.exe' manage.py test --settings=StrayAid_backend.test_settings
```

## Current Result

The full backend suite currently passes with `18` tests.
