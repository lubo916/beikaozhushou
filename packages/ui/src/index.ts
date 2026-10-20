// packages/ui：三端共用的组件、页面状态组件与令牌产物（ADR-026 决定 2）。样式入口为 @exam-prep/ui/theme.css。
// 组件按原型调用次数排优先级（ui-rules.md 第 11 节）：面板、按钮、标签、行列表、页头、表格、统计卡、筛选片、横条图、分段标签页、AI 标识、提议卡。
// 所有组件的样式只用令牌（styles/components.css），文案默认取 copy.zh-CN.json、都可以传入覆盖；业务数字只显示接口给的值。
export { COPY, fill } from "./lib/copy.ts";
export { cx } from "./lib/cx.ts";
export { UiLink, UiLinkProvider, type LinkRenderProps, type LinkRenderer } from "./lib/link.tsx";
export { usePrefersReducedMotion } from "./lib/motion.ts";
export { pageStateFromSearch, type PageStateSearchOptions } from "./lib/page-state.ts";

export {
  Button,
  IconButton,
  buttonClass,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
  type IconButtonProps,
} from "./basic/Button.tsx";
export { Card, type CardProps, type CardTone } from "./basic/Card.tsx";
export {
  FilterChips,
  Segmented,
  Tabs,
  type ChoiceOption,
  type FilterChipOption,
  type FilterChipsProps,
  type SegmentedProps,
  type TabItem,
  type TabsProps,
} from "./basic/Choice.tsx";
export {
  BarList,
  Columns,
  ContainerScope,
  DataTable,
  KeyValueList,
  PageHeader,
  Stat,
  StatGroup,
  type BarItem,
  type DataTableProps,
  type KeyValueItem,
  type PageHeaderProps,
  type StatProps,
  type TableColumn,
} from "./basic/Data.tsx";
export {
  Banner,
  ProgressBar,
  Skeleton,
  type BannerProps,
  type BannerTone,
  type ProgressBarProps,
  type SkeletonProps,
} from "./basic/Feedback.tsx";
export { Icon, type IconName } from "./basic/Icon.tsx";
export { List, ListRow, type ListProps, type ListRowProps } from "./basic/ListRow.tsx";
export {
  BottomSheet,
  Dialog,
  Drawer,
  Sheet,
  type DialogProps,
  type DrawerProps,
  type SheetProps,
  type SheetSide,
} from "./basic/Overlay.tsx";
export { Tag, type TagProps, type TagTone } from "./basic/Tag.tsx";

export { PageState, PageStates, type AbnormalState, type PageStateProps, type PageStatesProps } from "./states/PageState.tsx";

export { AiBadge, AiContent, ReasonTags, type AiBadgeProps, type AiContentProps, type ReasonTagsProps } from "./business/Ai.tsx";
export { EvidenceRow, Importance, KpCard, type EvidenceRowProps, type KpCardProps } from "./business/Knowledge.tsx";
export { MasteryGrid, MasteryLadder, type MasteryCell, type MasteryGridProps, type MasteryLadderProps } from "./business/Mastery.tsx";
export {
  ProposalCard,
  TaskGroup,
  TaskStrip,
  UndoBar,
  type ProposalCardProps,
  type TaskGroupProps,
  type TaskState,
  type TaskStripProps,
  type UndoBarProps,
} from "./business/Plan.tsx";
