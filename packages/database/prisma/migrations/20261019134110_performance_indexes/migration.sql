-- CreateIndex
CREATE INDEX "incident_media_media_id_idx" ON "incident_media"("media_id");

-- CreateIndex
CREATE INDEX "incidents_match_id_status_severity_created_at_idx" ON "incidents"("match_id", "status", "severity", "created_at");

-- CreateIndex
CREATE INDEX "incidents_match_id_section_type_created_at_idx" ON "incidents"("match_id", "section", "type", "created_at");

-- CreateIndex
CREATE INDEX "media_match_id_audience_uploaded_at_idx" ON "media"("match_id", "audience", "uploaded_at");

-- CreateIndex
CREATE INDEX "media_match_id_status_idx" ON "media"("match_id", "status");

-- CreateIndex
CREATE INDEX "media_user_id_uploaded_at_idx" ON "media"("user_id", "uploaded_at");

-- CreateIndex
CREATE INDEX "moment_media_media_id_idx" ON "moment_media"("media_id");

-- CreateIndex
CREATE INDEX "moments_match_id_status_promoted_created_at_idx" ON "moments"("match_id", "status", "promoted", "created_at");

-- CreateIndex
CREATE INDEX "moments_match_id_created_at_idx" ON "moments"("match_id", "created_at");
