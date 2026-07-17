import { createBrowserRouter } from "react-router";
import { ClientLayout } from "./layouts/ClientLayout";
import { SalonOwnerLayout } from "./layouts/SalonOwnerLayout";
import { RequireAuth } from "./components/RequireAuth";

// Client screens
import { SplashScreen } from "./screens/client/SplashScreen";
import { OnboardingScreen } from "./screens/client/OnboardingScreen";
import { LoginScreen } from "./screens/client/LoginScreen";
import { SignupScreen } from "./screens/client/SignupScreen";
import { ClientHome } from "./screens/client/ClientHome";
import { ReferralScreen } from "./screens/client/ReferralScreen";
import { RewardsScreen } from "./screens/client/RewardsScreen";
import { SalonsScreen } from "./screens/client/SalonsScreen";
import { SalonProfileScreen } from "./screens/client/SalonProfileScreen";
import { BookingScreen } from "./screens/client/BookingScreen";
import { MyAppointmentsScreen } from "./screens/client/MyAppointmentsScreen";
import { NotificationsScreen } from "./screens/client/NotificationsScreen";
import { ProfileScreen } from "./screens/client/ProfileScreen";
import { SettingsScreen } from "./screens/client/SettingsScreen";
import { PersonalInfoScreen } from "./screens/client/PersonalInfoScreen";

// Salon owner screens
import { SalonDashboard } from "./screens/salon/SalonDashboard";
import { ReferralAnalytics } from "./screens/salon/ReferralAnalytics";
import { RewardsManagement } from "./screens/salon/RewardsManagement";
import { ServicesManagement } from "./screens/salon/ServicesManagement";
import { SalonAppointments } from "./screens/salon/SalonAppointments";
import { ClientManagement } from "./screens/salon/ClientManagement";
import { CampaignCreation } from "./screens/salon/CampaignCreation";
import { SalonSettings } from "./screens/salon/SalonSettings";
import { BusinessInfoScreen } from "./screens/salon/BusinessInfoScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <SplashScreen />,
  },
  {
    path: "/onboarding",
    element: <OnboardingScreen />,
  },
  {
    path: "/login",
    element: <LoginScreen />,
  },
  {
    path: "/signup",
    element: <SignupScreen />,
  },
  {
    element: <RequireAuth role="client" />,
    children: [
      {
        path: "/client",
        element: <ClientLayout />,
        children: [
          { index: true, element: <ClientHome /> },
          { path: "referral", element: <ReferralScreen /> },
          { path: "rewards", element: <RewardsScreen /> },
          { path: "salons", element: <SalonsScreen /> },
          { path: "salons/:id", element: <SalonProfileScreen /> },
          { path: "salons/:id/book", element: <BookingScreen /> },
          { path: "appointments", element: <MyAppointmentsScreen /> },
          { path: "notifications", element: <NotificationsScreen /> },
          { path: "profile", element: <ProfileScreen /> },
          { path: "settings", element: <SettingsScreen /> },
          { path: "personal-info", element: <PersonalInfoScreen /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth role="salon_owner" />,
    children: [
      {
        path: "/salon",
        element: <SalonOwnerLayout />,
        children: [
          { index: true, element: <SalonDashboard /> },
          { path: "analytics", element: <ReferralAnalytics /> },
          { path: "rewards", element: <RewardsManagement /> },
          { path: "services", element: <ServicesManagement /> },
          { path: "appointments", element: <SalonAppointments /> },
          { path: "clients", element: <ClientManagement /> },
          { path: "campaigns", element: <CampaignCreation /> },
          { path: "settings", element: <SalonSettings /> },
          { path: "business-info", element: <BusinessInfoScreen /> },
        ],
      },
    ],
  },
]);