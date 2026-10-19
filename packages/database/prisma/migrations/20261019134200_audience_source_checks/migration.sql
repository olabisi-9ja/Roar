-- String columns that behave like enums are constrained at the database boundary as well as in the API.
ALTER TABLE "media" ADD CONSTRAINT "media_audience_check" CHECK ("audience" IN ('community', 'me', 'security'));
ALTER TABLE "moments" ADD CONSTRAINT "moments_source_check" CHECK ("source" IN ('editor', 'ai'));
