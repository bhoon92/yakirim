import { createBrowserRouter } from 'react-router';

import { RequireAuth } from '@/auth/require-auth';
import { AppLayout } from '@/routes/app-layout';
import { AttendancePage } from '@/routes/app/attendance';
import { CalendarPage } from '@/routes/app/calendar';
import { DashboardPage } from '@/routes/app/dashboard';
import { FinancePage } from '@/routes/app/finance';
import { GalleryPage } from '@/routes/app/gallery';
import { MembersPage } from '@/routes/app/members';
import { PipelinePage } from '@/routes/app/pipeline';
import { ResidentsPage } from '@/routes/app/residents';
import { MyFlockPage } from '@/routes/app/my-flock';
import { MissionariesPage } from '@/routes/app/missionaries';
import { OrganizationChartPage } from '@/routes/app/organization-chart';
import { SettingsPage } from '@/routes/app/settings';
import { TrainingPage } from '@/routes/app/training';
import { TeamPage } from '@/routes/app/settings/team';
import { ChurchSelectPage } from '@/routes/church-select';
import { HomePage } from '@/routes/home';
import { LoginPage } from '@/routes/login';
import { OnboardingPage } from '@/routes/onboarding';

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/onboarding', element: <OnboardingPage /> },
  { path: '/church-select', element: <ChurchSelectPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/app',
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'my-flock', element: <MyFlockPage /> },
          { path: 'residents', element: <ResidentsPage /> },
          { path: 'members', element: <MembersPage /> },
          { path: 'pipeline', element: <PipelinePage /> },
          { path: 'training', element: <TrainingPage /> },
          { path: 'missionaries', element: <MissionariesPage /> },
          { path: 'organization-chart', element: <OrganizationChartPage /> },
          { path: 'attendance', element: <AttendancePage /> },
          { path: 'finance', element: <FinancePage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'gallery', element: <GalleryPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'settings/team', element: <TeamPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <HomePage /> },
]);
