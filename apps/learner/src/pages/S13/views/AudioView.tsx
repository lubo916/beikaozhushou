// 简版听单沿用接口片段；不合成音频、不记录学习证据。
import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { S13Course } from "@exam-prep/contract";
import { formatCount, formatSeconds } from "@exam-prep/shared/format";
import { AiContent, Button, Card, Tag, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

export function AudioView({ course, available }: { course: S13Course; available: boolean }) {
  const { t } = useTranslation("S13");
  const [segmentId, setSegmentId] = useState(course.current_segment_id);
  const [playing, setPlaying] = useState(false);
  const current = course.segments.find((segment) => segment.id === segmentId) ?? course.segments[0];
  return (
    <div className="flex flex-col gap-4">
      <Card title={t("audio.title")} meta={t("audio.body")}>
        <ul className="flex flex-col divide-y divide-line-soft">
          {course.segments.map((segment) => (
            <li key={segment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium">{segment.point_name}</h3>
                <p className="text-small text-ink-tertiary">
                  {formatSeconds(segment.duration_seconds)} · {t(`mastery.${segment.mastery_level}`)}
                </p>
              </div>
              <Button
                size="sm"
                variant={segment.id === current?.id ? "primary" : "secondary"}
                disabled={!available}
                aria-label={t("audio.play_segment", { name: segment.point_name })}
                aria-pressed={segment.id === current?.id && playing}
                onClick={() => {
                  setSegmentId(segment.id);
                  setPlaying(segment.id === current?.id ? !playing : true);
                }}
              >
                {segment.id === current?.id && playing ? t("player.pause") : t("audio.listen")}
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-small text-ink-tertiary">{t("audio.demo")}</p>
      </Card>
      {current !== undefined && (
        <Card title={t("player.current")} meta={<Tag>{t(`sources.${course.source}`)}</Tag>}>
          <div className="flex flex-col gap-3">
            <h3 className="font-medium">{current.point_name}</h3>
            <p role="status" className="text-small text-ink-secondary">
              {playing ? t("player.playing") : t("player.paused")}
            </p>
            <AiContent note={t("transcript.ai")}>
              <p>{current.transcript}</p>
            </AiContent>
          </div>
        </Card>
      )}
      {/* feat:S13-04 听完即测仍需完整作答，不把听过自动算成有效学习。 */}
      {current !== undefined && (
        <Card title={t("audio.check")}>
          <div className="flex flex-col gap-3">
            <p>{t("check.body", { n: formatCount(current.check_count) })}</p>
            <Link className={buttonClass("primary")} to={pathTo("S18")}>
              {t("audio.check")}
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
