-- New table only; existing families, children and check-in requests are unchanged.
CREATE TABLE IF NOT EXISTS public_registration_submissions (
    submission_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    response_json MEDIUMTEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
