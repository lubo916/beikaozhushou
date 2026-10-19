-- CreateEnum
CREATE TYPE "UserKind" AS ENUM ('guest', 'registered');

-- CreateEnum
CREATE TYPE "UserAgeBand" AS ENUM ('unconfirmed', 'under_min', 'minor', 'adult');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'restricted', 'cooling_off', 'deleted');

-- CreateEnum
CREATE TYPE "QuestionKnowledgePointRelation" AS ENUM ('primary', 'secondary');

-- CreateEnum
CREATE TYPE "QuestionResponseForm" AS ENUM ('choice', 'fill', 'match_order', 'stepwise', 'written', 'material', 'listening', 'oral', 'practical_self');

-- CreateEnum
CREATE TYPE "QuestionCredibility" AS ENUM ('reviewed', 'own', 'generated_confirmed', 'generated_instant');

-- CreateEnum
CREATE TYPE "ExamProfileKind" AS ENUM ('official', 'template', 'custom');

-- CreateEnum
CREATE TYPE "ExamProfileEvaluationRule" AS ENUM ('pass_line', 'selective', 'score_band', 'custom');

-- CreateEnum
CREATE TYPE "EvidenceEventEventType" AS ENUM ('record', 'revoke');

-- CreateEnum
CREATE TYPE "EvidenceEventSource" AS ENUM ('practice', 'review', 'reading_quiz', 'mock', 'diagnosis', 'grading', 'self_check');

-- CreateEnum
CREATE TYPE "EvidenceEventCredibility" AS ENUM ('reviewed', 'own', 'generated_confirmed', 'generated_instant');

-- CreateEnum
CREATE TYPE "EvidenceEventConfidence" AS ENUM ('sure', 'vague', 'guess', 'off', 'none');

-- CreateEnum
CREATE TYPE "EvidenceEventStrength" AS ENUM ('strong', 'medium', 'weak', 'negative', 'pending');

-- CreateEnum
CREATE TYPE "MasteryLevelSufficiency" AS ENUM ('sufficient', 'insufficient');

-- CreateEnum
CREATE TYPE "KnowledgeMapSource" AS ENUM ('official', 'template', 'custom');

-- CreateEnum
CREATE TYPE "KnowledgeMapStatus" AS ENUM ('draft', 'published', 'retired');

-- CreateEnum
CREATE TYPE "KnowledgePointMappingKind" AS ENUM ('rename', 'move', 'merge', 'split', 'retire');

-- CreateEnum
CREATE TYPE "KnowledgePointNodeKind" AS ENUM ('subject', 'chapter', 'section', 'point');

-- CreateEnum
CREATE TYPE "KnowledgePointLayer" AS ENUM ('base', 'extension');

-- CreateEnum
CREATE TYPE "KnowledgePointKnowledgeTypes" AS ENUM ('concept', 'fact', 'statute', 'procedure', 'application', 'essay', 'oral', 'practical', 'accumulation');

-- CreateEnum
CREATE TYPE "AnalyticsEventSource" AS ENUM ('client', 'server');

-- CreateEnum
CREATE TYPE "TenantKind" AS ENUM ('platform_default', 'org');

-- CreateEnum
CREATE TYPE "ProposalKind" AS ENUM ('carryover', 'scope', 'rounds', 'goal', 'reinforcement', 'sprint', 'other');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('pending', 'accepted', 'declined', 'auto_applied', 'undone', 'expired');

-- CreateEnum
CREATE TYPE "TimeBudgetSource" AS ENUM ('declared', 'measured');

-- CreateEnum
CREATE TYPE "TimeReservationSourceKind" AS ENUM ('goal', 'org_task', 'class_schedule', 'custom');

-- CreateEnum
CREATE TYPE "AnswerRecordConfidence" AS ENUM ('sure', 'vague', 'guess', 'off', 'none');

-- CreateEnum
CREATE TYPE "PracticeSessionKind" AS ENUM ('practice', 'diagnosis', 'mock', 'retry', 'variant');

-- CreateEnum
CREATE TYPE "PracticeSessionMode" AS ENUM ('in_class', 'quick', 'timed', 'assessment');

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "guest" BOOLEAN NOT NULL,
    "timezone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "source" "AnalyticsEventSource" NOT NULL,
    "properties" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "idempotency_key" TEXT,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "question_version" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "correct" BOOLEAN,
    "confidence" "AnswerRecordConfidence" NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "hint_level" INTEGER NOT NULL,
    "revealed_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "answer_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "event_type" "EvidenceEventEventType" NOT NULL,
    "revokes_event_id" UUID,
    "knowledge_point_id" UUID NOT NULL,
    "source" "EvidenceEventSource" NOT NULL,
    "source_ref" UUID,
    "question_id" UUID,
    "question_version" INTEGER,
    "credibility" "EvidenceEventCredibility",
    "correct" BOOLEAN,
    "confidence" "EvidenceEventConfidence" NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "hint_level" INTEGER NOT NULL,
    "strength" "EvidenceEventStrength" NOT NULL,
    "rule_version" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "evidence_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "exam_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" "ExamProfileKind" NOT NULL,
    "evaluation_rule" "ExamProfileEvaluationRule" NOT NULL,
    "profile" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exam_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_maps" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "exam_profile_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "source" "KnowledgeMapSource" NOT NULL,
    "status" "KnowledgeMapStatus" NOT NULL,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "knowledge_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_point_mappings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" "KnowledgePointMappingKind" NOT NULL,
    "from_point_ids" UUID[],
    "to_point_ids" UUID[],
    "from_version" INTEGER NOT NULL,
    "to_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "knowledge_point_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_points" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "map_id" UUID NOT NULL,
    "parent_id" UUID,
    "node_kind" "KnowledgePointNodeKind" NOT NULL,
    "layer" "KnowledgePointLayer" NOT NULL,
    "name" TEXT NOT NULL,
    "knowledge_types" "KnowledgePointKnowledgeTypes"[],
    "default_target_level" INTEGER,
    "importance" TEXT,
    "since_version" INTEGER NOT NULL,
    "retired_in_version" INTEGER,

    CONSTRAINT "knowledge_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mastery_levels" (
    "learner_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "knowledge_point_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "sufficiency" "MasteryLevelSufficiency" NOT NULL,
    "pending_verification" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "last_evidence_at" TIMESTAMPTZ(6),
    "rule_version" TEXT NOT NULL,
    "recomputed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mastery_levels_pkey" PRIMARY KEY ("learner_id","knowledge_point_id")
);

-- CreateTable
CREATE TABLE "practice_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "kind" "PracticeSessionKind" NOT NULL,
    "mode" "PracticeSessionMode" NOT NULL,
    "scope" JSONB NOT NULL,
    "mastery_snapshot" JSONB,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "proposer" TEXT NOT NULL,
    "kind" "ProposalKind" NOT NULL,
    "change" JSONB NOT NULL,
    "reason" JSONB NOT NULL,
    "cost" JSONB NOT NULL,
    "if_declined" JSONB NOT NULL,
    "status" "ProposalStatus" NOT NULL,
    "undo_until" TIMESTAMPTZ(6),
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_knowledge_points" (
    "question_id" UUID NOT NULL,
    "knowledge_point_id" UUID NOT NULL,
    "relation" "QuestionKnowledgePointRelation" NOT NULL,

    CONSTRAINT "question_knowledge_points_pkey" PRIMARY KEY ("question_id","knowledge_point_id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "tenant_id" UUID NOT NULL,
    "exam_profile_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "response_form" "QuestionResponseForm" NOT NULL,
    "question_type" TEXT NOT NULL,
    "stem" JSONB NOT NULL,
    "options" JSONB,
    "answer" JSONB NOT NULL,
    "explanation" JSONB NOT NULL,
    "option_notes" JSONB,
    "credibility" "QuestionCredibility" NOT NULL,
    "source_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "kind" "TenantKind" NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_budgets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "weekly_grid" JSONB,
    "daily_minutes" INTEGER,
    "unavailable_dates" DATE[],
    "source" "TimeBudgetSource" NOT NULL,
    "valid_from" DATE NOT NULL,

    CONSTRAINT "time_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_reservations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "source_kind" "TimeReservationSourceKind" NOT NULL,
    "source_ref" UUID NOT NULL,

    CONSTRAINT "time_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" "UserKind" NOT NULL,
    "phone" TEXT,
    "phone_verified_at" TIMESTAMPTZ(6),
    "age_band" "UserAgeBand" NOT NULL,
    "minor_mode" BOOLEAN NOT NULL,
    "merged_into" UUID,
    "merged_at" TIMESTAMPTZ(6),
    "status" "UserStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_events_idempotency_key_key" ON "analytics_events"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_events_idempotency_key_key" ON "evidence_events"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "exam_profiles_exam_key_version_key" ON "exam_profiles"("exam_key", "version");

-- AddForeignKey
ALTER TABLE "answer_records" ADD CONSTRAINT "answer_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_records" ADD CONSTRAINT "answer_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_records" ADD CONSTRAINT "answer_records_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_records" ADD CONSTRAINT "answer_records_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_events" ADD CONSTRAINT "evidence_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_events" ADD CONSTRAINT "evidence_events_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_events" ADD CONSTRAINT "evidence_events_revokes_event_id_fkey" FOREIGN KEY ("revokes_event_id") REFERENCES "evidence_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_events" ADD CONSTRAINT "evidence_events_knowledge_point_id_fkey" FOREIGN KEY ("knowledge_point_id") REFERENCES "knowledge_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_events" ADD CONSTRAINT "evidence_events_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_profiles" ADD CONSTRAINT "exam_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_maps" ADD CONSTRAINT "knowledge_maps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_maps" ADD CONSTRAINT "knowledge_maps_exam_profile_id_fkey" FOREIGN KEY ("exam_profile_id") REFERENCES "exam_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_point_mappings" ADD CONSTRAINT "knowledge_point_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_points" ADD CONSTRAINT "knowledge_points_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_points" ADD CONSTRAINT "knowledge_points_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "knowledge_maps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_points" ADD CONSTRAINT "knowledge_points_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "knowledge_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery_levels" ADD CONSTRAINT "mastery_levels_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery_levels" ADD CONSTRAINT "mastery_levels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery_levels" ADD CONSTRAINT "mastery_levels_knowledge_point_id_fkey" FOREIGN KEY ("knowledge_point_id") REFERENCES "knowledge_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_knowledge_points" ADD CONSTRAINT "question_knowledge_points_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_knowledge_points" ADD CONSTRAINT "question_knowledge_points_knowledge_point_id_fkey" FOREIGN KEY ("knowledge_point_id") REFERENCES "knowledge_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_exam_profile_id_fkey" FOREIGN KEY ("exam_profile_id") REFERENCES "exam_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_budgets" ADD CONSTRAINT "time_budgets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_budgets" ADD CONSTRAINT "time_budgets_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_reservations" ADD CONSTRAINT "time_reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_reservations" ADD CONSTRAINT "time_reservations_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_merged_into_fkey" FOREIGN KEY ("merged_into") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
