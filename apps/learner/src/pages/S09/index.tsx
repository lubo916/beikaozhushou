// S09 知识地图（U09，照样板页 S10 写；写法说明在 docs/baseline/ui-rules.md 第 13 节）。页面只管显示：数据经 data.ts 里生成的钩子拿，
// 七态由接口层制造，这里按请求结果选显示哪一态（?state= 不用页面写分支）。原型：python3 tools/bk.py spec S09、bk proto S09。
// 四个视图（feat:S09-01）用 ?view=grid|tree|graph|list 切换，点标签时地址也跟着变（U09-Q2）；没写 ?view= 时手机默认大纲树（S09-18，U09-Q3）。
// 布局（S09.css）：桌面左边视图卡、右边统计、选中的知识点、需要你注意、地图来源与体检；平板全部上下排、视图卡在前；手机先两数与“需要你注意”。
import "./S09.css";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import type { S09MapOverview } from "@exam-prep/contract";
import { param } from "@exam-prep/params";
import { Button, COPY, Card, ContainerScope, PageState, Tabs, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { useNarrow } from "../../app/useNarrow.ts";
import { pathTo } from "../../routes.ts";
import { AttentionCard } from "./components/AttentionCard.tsx";
import { FocusCard } from "./components/FocusCard.tsx";
import { MapHeader } from "./components/MapHeader.tsx";
import { MapSkeleton } from "./components/MapSkeleton.tsx";
import { HEALTH_ID, SourceCard } from "./components/SourceCard.tsx";
import { StatsCard } from "./components/StatsCard.tsx";
import { VIEW_KEYS, indexPoints, useKnowledgeMapOverview, viewFromSearch, type MapNotice, type ViewKey } from "./data.ts";
import { GraphView } from "./views/GraphView.tsx";
import { GridView } from "./views/GridView.tsx";
import { ListView } from "./views/ListView.tsx";
import { TreeView } from "./views/TreeView.tsx";

/** 把“去修复”带到地图体检那一块。 */
function goToHealth(): void {
  const target = document.getElementById(HEALTH_ID);
  target?.scrollIntoView({ block: "center" });
  target?.focus();
}

interface BodyProps {
  readonly data: S09MapOverview;
  readonly notices: readonly MapNotice[];
  readonly locked: boolean;
  readonly view: ViewKey;
  readonly onView: (view: ViewKey) => void;
  readonly retry: () => void;
}

/** 照常显示（含顶上的离线、受限、数据不足提示条）。 */
function MapBody({ data, notices, locked, view, onView, retry }: BodyProps) {
  const { t } = useTranslation("S09");
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const points = useMemo(() => indexPoints(data.chapters), [data.chapters]);
  const pickedPoint = picked === undefined ? undefined : points.get(picked);
  const focus = pickedPoint ?? (data.focus_point_id === undefined ? undefined : points.get(data.focus_point_id));
  const selectedId = focus?.point.id;
  const onSelect = useCallback((id: string) => setPicked(id), []);
  return (
    <>
      {notices.map((notice) => (
        <PageState
          key={notice}
          state={notice}
          compact
          title={t(`state.${notice}.title`)}
          body={t(`state.${notice}.body`)}
          action={
            notice === "offline" ? (
              <Button size="sm" onClick={retry}>
                {COPY.action.retry}
              </Button>
            ) : undefined
          }
        />
      ))}
      <MapHeader sample={data.data_source === "sample"} restricted={data.access === "extension_only"} />
      <div className="s09-layout">
        <Card className="s09-views">
          <Tabs label={t("views.label")} items={VIEW_KEYS.map((key) => ({ key, label: t(`views.${key}`) }))} value={view} onChange={onView}>
            {view === "grid" && <GridView data={data} locked={locked} selectedId={selectedId} onSelect={onSelect} onFix={goToHealth} />}
            {view === "tree" && <TreeView chapters={data.chapters} />}
            {view === "graph" && <GraphView relations={data.relations} />}
            {view === "list" && <ListView chapters={data.chapters} locked={locked} />}
          </Tabs>
        </Card>
        <div className="s09-aside">
          <StatsCard className="s09-stats" stats={data.stats} />
          <FocusCard className="s09-focus" focus={focus} picked={pickedPoint !== undefined} />
          <AttentionCard className="s09-attention" attention={data.attention} />
          <SourceCard className="s09-source" map={data.map} sources={data.sources} typing={data.typing} health={data.health} />
        </div>
      </div>
    </>
  );
}

export default function Page() {
  const { t } = useTranslation("S09");
  const { t: tc } = useTranslation();
  const toast = useToast();
  const frame = useRef<HTMLDivElement | null>(null);
  const narrow = useNarrow(frame);
  const [search, setSearch] = useSearchParams();
  const view = viewFromSearch(search.get("view"), narrow);
  const map = useKnowledgeMapOverview();
  const pageName = tc("page.S09");
  const onView = useCallback(
    (key: ViewKey) => {
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("view", key);
          return next;
        },
        { replace: true },
      );
    },
    [setSearch],
  );

  let body: ReactNode;
  if (map.state === "loading") {
    body = (
      <PageState
        state="loading"
        pageName={pageName}
        skeleton={<MapSkeleton />}
        slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
      />
    );
  } else if (map.state === "offline") {
    body = (
      <PageState
        state="offline"
        pageName={pageName}
        body={t("state.offline.body")}
        action={<Button onClick={map.retry}>{COPY.action.retry}</Button>}
      />
    );
  } else if (map.state === "restricted") {
    body = <PageState state="restricted" pageName={pageName} body={t("state.restricted.body")} />;
  } else if (map.state === "error" || map.data === undefined) {
    body = <PageState state="error" pageName={pageName} onRetry={map.retry} onReport={() => toast(t("soon.report"))} />;
  } else if (map.state === "empty") {
    body = (
      <>
        <MapHeader sample={false} restricted={false} bare />
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <Link to={pathTo("S11")} className={buttonClass("primary")}>
              {t("state.empty.action")}
            </Link>
          }
        />
      </>
    );
  } else {
    body = <MapBody data={map.data} notices={map.notices} locked={map.locked} view={view} onView={onView} retry={map.retry} />;
  }
  return (
    <div ref={frame} className="s09-frame">
      <ContainerScope className="s09-page">{body}</ContainerScope>
    </div>
  );
}
