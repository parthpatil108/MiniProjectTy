# Deterministic Seed Data Schema Specification

This document details the exact JSON field shapes, types, and fixed ID conventions for Team C's deterministic seed data generator (`seed/seedData.js`), per `docs/04-team-c-implementation-plan.md` §4.3.

All teams (A, B, C, D) must reference these exact IDs and object structures when building mock fixtures and contract tests.

---

## Seed Data Rules

1. **Deterministic IDs:** All IDs are fixed strings/UUIDs. Random UUID/ID generation during seed script execution is strictly forbidden.
2. **Initial State:**
   - **Students:** ≥ 20 pre-seeded student records.
   - **Drives:** ≥ 5 pre-seeded drive records.
   - **Applications:** 0 pre-seeded applications (starts empty so idempotency and concurrency tests begin from a clean slate).

---

## 1. Student Entity Schema (`students.json`)

### Fields & Constraints

| Field        | Type            | Required | Description / Example                                                            |
| :----------- | :-------------- | :------- | :------------------------------------------------------------------------------- |
| `student_id` | `string`        | Yes      | Fixed ID string (e.g., `"STU-1001"`, `"STU-1002"`, ...).                         |
| `name`       | `string`        | Yes      | Full student name (e.g., `"Rahul Sharma"`).                                      |
| `branch`     | `string`        | Yes      | Academic branch (`"CSE"`, `"IT"`, `"ECE"`, `"MECH"`).                            |
| `cgpa`       | `number`        | Yes      | Float in range [0.0, 10.0]. Spans values above/below cutoffs (e.g., 6.2 to 9.6). |
| `backlogs`   | `integer`       | Yes      | Active backlog count (e.g., `0`, `1`, `2`).                                      |
| `attendance` | `number`        | Yes      | Attendance percentage float in range [0.0, 100.0] (e.g., `85.5`).                |
| `skill_tags` | `array<string>` | Yes      | Array of skill strings (e.g., `["Node.js", "TypeScript", "Algorithms"]`).        |
| `version`    | `integer`       | Yes      | Always starts at `1`.                                                            |
| `created_at` | `string`        | Yes      | Fixed ISO-8601 UTC timestamp (e.g., `"2026-08-01T00:00:00.000Z"`).               |
| `updated_at` | `string`        | Yes      | Fixed ISO-8601 UTC timestamp (e.g., `"2026-08-01T00:00:00.000Z"`).               |

### Example Seed Record

```json
{
  "student_id": "STU-1001",
  "name": "Rahul Sharma",
  "branch": "CSE",
  "cgpa": 8.45,
  "backlogs": 0,
  "attendance": 92.5,
  "skill_tags": ["Node.js", "TypeScript", "Algorithms"],
  "version": 1,
  "created_at": "2026-08-01T00:00:00.000Z",
  "updated_at": "2026-08-01T00:00:00.000Z"
}
```

---

## 2. Placement Drive Entity Schema (`drives.json`)

### Fields & Constraints

| Field        | Type            | Required | Description / Example                                                                   |
| :----------- | :-------------- | :------- | :-------------------------------------------------------------------------------------- |
| `drive_id`   | `string` (UUID) | Yes      | Fixed deterministic UUID (e.g., `"550e8400-e29b-41d4-a716-446655440001"`).              |
| `company`    | `string`        | Yes      | Company name string (e.g., `"TechCorp Inc."`).                                          |
| `criteria`   | `object`        | Yes      | Criteria nested object (see below).                                                     |
| `seats`      | `integer`       | Yes      | Total available seats. Small seat counts (`1` or `2`) included for slot-conflict tests. |
| `package`    | `string`        | Yes      | Display compensation string (e.g., `"12 LPA"`).                                         |
| `state`      | `string`        | Yes      | Enum: `"DRAFT"`, `"OPEN"`, `"CLOSED"`, `"ARCHIVED"`. Initial seed state is `"OPEN"`.    |
| `version`    | `integer`       | Yes      | Always starts at `1`.                                                                   |
| `created_at` | `string`        | Yes      | Fixed ISO-8601 UTC timestamp (e.g., `"2026-08-01T00:00:00.000Z"`).                      |
| `updated_at` | `string`        | Yes      | Fixed ISO-8601 UTC timestamp (e.g., `"2026-08-01T00:00:00.000Z"`).                      |

### Drive Criteria Object Fields

| Nested Field          | Type            | Description                                                  |
| :-------------------- | :-------------- | :----------------------------------------------------------- |
| `min_cgpa`            | `number`        | Minimum CGPA threshold float (e.g., `7.5`).                  |
| `max_backlogs`        | `integer`       | Maximum allowable active backlogs (e.g., `0`).               |
| `allowed_branches`    | `array<string>` | Eligible branch list (e.g., `["CSE", "IT"]`).                |
| `min_attendance`      | `number`        | Minimum attendance percentage float (e.g., `75.0`).          |
| `required_skill_tags` | `array<string>` | Required skills list (e.g., `["TypeScript", "Algorithms"]`). |

### Example Seed Record

```json
{
  "drive_id": "550e8400-e29b-41d4-a716-446655440001",
  "company": "TechCorp Inc.",
  "criteria": {
    "min_cgpa": 7.5,
    "max_backlogs": 0,
    "allowed_branches": ["CSE", "IT", "ECE"],
    "min_attendance": 75.0,
    "required_skill_tags": ["TypeScript", "Algorithms"]
  },
  "seats": 2,
  "package": "12 LPA",
  "state": "OPEN",
  "version": 1,
  "created_at": "2026-08-01T00:00:00.000Z",
  "updated_at": "2026-08-01T00:00:00.000Z"
}
```

---

## 3. Seed ID Mapping Table for Test Fixtures

| Entity       | Primary Key / ID                                 | Pre-seeded Range   | Purpose in Contract Tests                                                          |
| :----------- | :----------------------------------------------- | :----------------- | :--------------------------------------------------------------------------------- |
| **Students** | `STU-1001` .. `STU-1025`                         | 25 Student Records | CGPA cutoff testing, branch filtering, ranking pool calculations.                  |
| **Drives**   | `550e8400-e29b-41d4-a716-446655440001` .. `0005` | 5 Placement Drives | `0001` has seats=2 for slot conflict testing; `0002` has strict CGPA cutoff (8.5). |
