# Component Overview - KPI Quest 2

This document provides an overview of the UI components used in KPI Quest 2.

## 🎨 UI Framework

KPI Quest 2 leverages **Tailwind CSS** for styling and **shadcn/ui** for a set of high-quality, accessible UI primitives.

### UI Primitives (`src/components/ui/`)

These are the base building blocks for the application. They are designed for consistency and ease of use.
- **Form Components**: `Button`, `Input`, `Label`, `Checkbox`, `Select`, `Textarea`, `Switch`, `RadioGroup`.
- **Layout Components**: `Card`, `Separator`, `ScrollArea`, `Tabs`, `Accordion`, `Sheet`, `Sidebar`.
- **Feedback Components**: `Toast`, `Toaster`, `Skeleton`, `Progress`, `Tooltip`.
- **Navigation Components**: `DropdownMenu`, `Menubar`, `Popover`.
- **Data Display Components**: `Table`, `Badge`, `Avatar`, `Chart`.

## 🏗 Custom Shared Components (`src/components/`)

These components are specific to the application's domain and are reused across different pages.

| Component | Description |
| :--- | :--- |
| `AppNavBar` | Main navigation bar that handles RBAC and user profile. |
| `DashboardLayout` | Standard layout for main dashboard pages. |
| `UserForm` | Form for creating and editing user accounts. |
| `CampaignForm` | Form for managing campaign definitions and rules. |
| `PodForm` | Form for managing pods and campaign assignments. |
| `TrackerCard` | Displays KPI tracking progress for campaigns and pods. |
| `AchievementCard` | Visualizes individual achievements. |
| `Leaderboard` | Flexible component for displaying rankings (individual, team, pod). |
| `LexicalEditor` | Rich-text editor for competition rules. |
| `DateRangePicker` | Shared component for selecting custom date ranges. |

## 📊 Charting

The application uses **Recharts** for visualizing performance data.
- **Usage**: Located primarily in the **Performance** and **Competition Dashboard** views.
- **Components**: `AreaChart`, `BarChart`, `LineChart`.
- **Theme Support**: Charts are fully responsive and support both Light and Dark modes.

## 🛡 Accessibility (A11y)

All components are designed to be fully accessible, following **WCAG 2.2 Level AA** standards.
- **Semantic HTML**: Using correct landmarks (`header`, `nav`, `main`, `footer`).
- **Keyboard Navigation**: Native button/input elements and proper `tabindex` for custom controls.
- **ARIA Attributes**: `aria-label`, `aria-describedby`, `aria-expanded`, and `role` attributes where necessary.
- **Contrast**: Ensuring high-contrast text and icons for better readability.

## 🚀 Building New Components

When building new components:
1.  **Start with shadcn/ui primitives**: Reuse existing base components for consistency.
2.  **Use Tailwind CSS**: Follow the project's utility-first approach.
3.  **Ensure Accessibility**: Test with keyboard and screen readers.
4.  **Add to `src/components/`**: If the component is reused across multiple pages.
